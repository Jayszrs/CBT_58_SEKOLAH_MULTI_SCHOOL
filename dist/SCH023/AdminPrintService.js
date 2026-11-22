/** Data cetak analisis; setiap peserta diwakili percobaan terbaru pada Respon_Jawaban. */
function getPrintAnalysisIndex_(mapelFilter) {
  var context = getPrintAnalysisContext_();
  var filter = String(mapelFilter || '').trim();
  var index = [];
  Object.keys(context.latestResponsesByStudentSubject).forEach(function (nisn) {
    var subjectMap = context.latestResponsesByStudentSubject[nisn] || {};
    var subjectNames = Object.keys(subjectMap).filter(function (mapel) { return !filter || mapel === filter; });
    if (!subjectNames.length) return;
    var rows = subjectNames.map(function (mapel) { return subjectMap[mapel]; });
    var latestRow = rows.reduce(function (latest, row) {
      return getPrintTimestampKey_(row[0], 0) >= getPrintTimestampKey_(latest[0], 0) ? row : latest;
    }, rows[0]);
    var student = context.students[nisn] || { nisn: nisn, nama: 'Data peserta tidak ditemukan', kelas: '-' };
    index.push({
      nisn: nisn,
      nama: student.nama,
      kelas: student.kelas,
      mapel: filter || subjectNames.sort().join(', '),
      jumlahAnalisis: subjectNames.length,
      timestamp: formatPrintTimestamp_(latestRow[0]),
      status: String(latestRow[6] || '-')
    });
  });
  index.sort(function (a, b) { return String(a.nisn).localeCompare(String(b.nisn), 'id', { numeric: true }); });
  return index;
}

function getPrintAnalysisReport_(nisn, mapelFilter) {
  var context = getPrintAnalysisContext_();
  var key = String(nisn || '').trim();
  var subjectMap = context.latestResponsesByStudentSubject[key] || {};
  var filter = String(mapelFilter || '').trim();
  var subjectNames = Object.keys(subjectMap).filter(function (mapel) { return !filter || mapel === filter; }).sort();
  if (!key || !subjectNames.length) {
    return { success: false, message: 'Data analisis peserta belum ditemukan. Pastikan peserta sudah mengirim jawaban ujian.' };
  }
  var reports = subjectNames.map(function (mapel) {
    return buildPrintAnalysisReport_(key, subjectMap[mapel], context);
  });
  return { success: true, reports: reports, report: reports.length === 1 ? reports[0] : null };
}

function getPrintAnalysisAll_(mapelFilter) {
  var context = getPrintAnalysisContext_();
  var filter = String(mapelFilter || '').trim();
  var nisnList = Object.keys(context.latestResponsesByStudentSubject).sort(function (a, b) {
    return String(a).localeCompare(String(b), 'id', { numeric: true });
  });
  var reports = [];
  nisnList.forEach(function (nisn) {
    var subjectMap = context.latestResponsesByStudentSubject[nisn] || {};
    Object.keys(subjectMap).sort().forEach(function (mapel) {
      if (filter && mapel !== filter) return;
      reports.push(buildPrintAnalysisReport_(nisn, subjectMap[mapel], context));
    });
  });
  return { success: true, reports: reports, count: reports.length };
}

/** Hanya mengirim matriks biner, bukan seluruh HTML soal, untuk rekap satu kelas/sekolah. */
function getPrintAnalysisMatrix_(mapelFilter) {
  var context = getPrintAnalysisContext_();
  var filter = String(mapelFilter || '').trim();
  var groups = {};
  Object.keys(context.latestResponsesByStudentSubject).sort().forEach(function(nisn) {
    var subjectMap = context.latestResponsesByStudentSubject[nisn] || {};
    Object.keys(subjectMap).sort().forEach(function(mapel) {
      if (filter && filter !== mapel) return;
      var report = buildPrintAnalysisReport_(nisn, subjectMap[mapel], context);
      var group = groups[mapel];
      if (!group) group = groups[mapel] = { mapel: mapel, soalIds: resolveQuestionsForPrint_(mapel,context).map(function(q) { return String(q.id); }), siswa: [] };
      var byId = {};
      report.questions.forEach(function(q) { byId[String(q.id)] = q.skor >= q.bobot && q.bobot > 0 ? 1 : 0; });
      var points = group.soalIds.map(function(id) { return byId[id] === 1 ? 1 : 0; });
      group.siswa.push({ nisn: String(nisn), nama: report.siswa.nama, kelas: report.siswa.kelas, poin: points,
        benar: points.reduce(function(a, b) { return a + b; }, 0), total: points.length,
        nilaiAkhir: Number(subjectMap[mapel][5]) || 0, status: report.status, waktu: report.waktu });
    });
  });
  // Tampilkan juga siswa tanpa kiriman jawaban; jangan hilangkan dari daftar seluruh siswa.
  if (!filter) {
    context.allQuestions.forEach(function(q){
      var name=String(q.mapel||'').trim();
      if (name && !groups[name]) groups[name]={mapel:name,soalIds:resolveQuestionsForPrint_(name,context).map(function(item){return String(item.id);}),siswa:[]};
    });
  }
  if (filter && !groups[filter]) {
    var matching = resolveQuestionsForPrint_(filter, context);
    groups[filter] = { mapel: filter, soalIds: matching.map(function(q){return String(q.id);}), siswa: [] };
  }
  Object.keys(groups).forEach(function(mapel) {
    var group=groups[mapel];
    var completed = {};
    group.siswa.forEach(function(row) {completed[row.nisn]=true;});
    Object.keys(context.students).forEach(function(nisn) {
      if (completed[nisn]) return;
      var student = context.students[nisn];
      group.siswa.push({nisn:nisn,nama:student.nama,kelas:student.kelas,poin:group.soalIds.map(function(){return 0;}),
        benar:0,total:group.soalIds.length,nilaiAkhir:null,status:'Belum mengerjakan',waktu:'-'});
    });
    group.siswa.sort(function(a,b){return String(a.kelas).localeCompare(String(b.kelas),'id') || String(a.nisn).localeCompare(String(b.nisn),'id',{numeric:true});});
  });
  return { success: true, groups: Object.keys(groups).sort().map(function(name) { return groups[name]; }) };
}

function getPrintAnalysisContext_() {
  var ss = getOrCreateSpreadsheet_();
  var studentSheet = ss.getSheetByName('Data_Siswa');
  var responseSheet = ss.getSheetByName('Respon_Jawaban');
  var studentData = studentSheet ? studentSheet.getDataRange().getValues() : [];
  var responseData = responseSheet ? responseSheet.getDataRange().getValues() : [];
  var students = {};
  for (var i = 1; i < studentData.length; i++) {
    var nisn = String(studentData[i][0] || '').trim();
    if (!nisn) continue;
    students[nisn] = { nisn: nisn, nama: SecurityService.sanitizeData(String(studentData[i][1] || '-')), kelas: SecurityService.sanitizeData(String(studentData[i][2] || '-')) };
  }
  var latestResponses = {};
  var latestKeys = {};
  var latestResponsesByStudentSubject = {};
  var subjectKeys = {};
  for (var r = 1; r < responseData.length; r++) {
    var responseNisn = String(responseData[r][1] || '').trim();
    if (!responseNisn) continue;
    var responseMapel = String(responseData[r][9] || '-');
    var timestampKey = getPrintTimestampKey_(responseData[r][0], r);
    if (!latestResponses[responseNisn] || timestampKey >= latestKeys[responseNisn]) {
      latestResponses[responseNisn] = responseData[r];
      latestKeys[responseNisn] = timestampKey;
    }
    if (!latestResponsesByStudentSubject[responseNisn]) latestResponsesByStudentSubject[responseNisn] = {};
    if (!subjectKeys[responseNisn]) subjectKeys[responseNisn] = {};
    if (!latestResponsesByStudentSubject[responseNisn][responseMapel] || timestampKey >= subjectKeys[responseNisn][responseMapel]) {
      latestResponsesByStudentSubject[responseNisn][responseMapel] = responseData[r];
      subjectKeys[responseNisn][responseMapel] = timestampKey;
    }
  }
  return {
    students: students,
    latestResponses: latestResponses,
    latestResponsesByStudentSubject: latestResponsesByStudentSubject,
    allQuestions: getAllSoal_(true) || [],
    packages: getAllPaketSoal_(true) || []
  };
}

function getPrintTimestampKey_(value, fallback) {
  if (value instanceof Date) return value.getTime();
  var parsed = new Date(String(value || '').replace(' ', 'T')).getTime();
  return isNaN(parsed) ? fallback : parsed;
}

function formatPrintTimestamp_(value) {
  if (!value) return '-';
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss');
  var parsed = new Date(String(value).replace(' ', 'T'));
  return !isNaN(parsed.getTime()) ? Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss') : String(value);
}

function buildPrintAnalysisReport_(nisn, row, context) {
  var student = context.students[nisn] || { nisn: nisn, nama: 'Data peserta tidak ditemukan', kelas: '-' };
  var answers = {}, manualScores = {};
  try { answers = row[2] ? JSON.parse(row[2]) : {}; } catch (e) { answers = {}; }
  try { manualScores = row[8] ? JSON.parse(row[8]) : {}; } catch (e) { manualScores = {}; }
  var mapelLabel = String(row[9] || '-');
  var questions = resolveQuestionsForPrint_(mapelLabel, context);
  var savedOrder = Array.isArray(manualScores.__urutan_soal__) ? manualScores.__urutan_soal__.map(String) : [];
  if (savedOrder.length) {
    var orderPosition = {}; savedOrder.forEach(function(id,i){orderPosition[id]=i;});
    questions = questions.slice().sort(function(a,b){
      var indexA = Object.prototype.hasOwnProperty.call(orderPosition,String(a.id)) ? orderPosition[String(a.id)] : 999999;
      var indexB = Object.prototype.hasOwnProperty.call(orderPosition,String(b.id)) ? orderPosition[String(b.id)] : 999999;
      return indexA - indexB;
    });
  }
  var questionReports = [];
  var calculatedScore = 0, calculatedMax = 0;
  var objectiveCount = 0, objectiveCorrect = 0, objectiveWrong = 0;
  var typeStats = {};
  var essayEarned = 0, essayMax = 0;

  questions.forEach(function (question, index) {
    var answer = Object.prototype.hasOwnProperty.call(answers, question.id) ? answers[question.id] : null;
    var key = question.kunci_jawaban;
    var weight = Number(question.bobot) || 1;
    var isEssay = question.tipe === 'Esai';
    var isCorrect = false, resultLabel = '', earned = 0, displayedScore = 0, displayedMax = 1;

    if (isEssay) {
      essayMax += weight;
      if (Object.prototype.hasOwnProperty.call(manualScores, question.id)) {
        earned = Math.max(0, Math.min(weight, Number(manualScores[question.id] && typeof manualScores[question.id] === 'object' ? manualScores[question.id].skor : manualScores[question.id]) || 0));
        essayEarned += earned;
        resultLabel = 'Dinilai guru';
        displayedScore = earned;
        displayedMax = weight;
      } else {
        resultLabel = 'Belum dikoreksi';
        displayedScore = 0;
        displayedMax = weight;
      }
      calculatedScore += earned;
      calculatedMax += weight;
    } else {
      var isTeacherScoredShortAnswer = question.tipe === 'Isian Singkat' && Object.prototype.hasOwnProperty.call(manualScores, question.id);
      if (question.tipe === 'PG' || question.tipe === 'PG Kompleks' || question.tipe === 'Menjodohkan' || question.tipe === 'Benar Salah' || question.tipe === 'Sesuai Tidak Sesuai') isCorrect = checkObjectiveAnswer_(question, answer);
      else if (question.tipe === 'Isian Singkat') {
        if (isTeacherScoredShortAnswer) {
          var shortAnswerScore = Math.max(0, Math.min(weight, Number(manualScores[question.id] && typeof manualScores[question.id] === 'object' ? manualScores[question.id].skor : manualScores[question.id]) || 0));
          isCorrect = shortAnswerScore >= weight;
        } else isCorrect = normalizeGradingText_(answer) === normalizeGradingText_(key) && !isPrintAnswerEmpty_(answer);
      }

      // Laporan analisis menggunakan skor biner: benar=1, salah/tidak dijawab=0.
      displayedScore = isCorrect ? 1 : 0;
      displayedMax = 1;
      earned = displayedScore;
      objectiveCount++;
      if (isCorrect) objectiveCorrect++; else objectiveWrong++;
      calculatedScore += earned;
      calculatedMax += 1;

      var typeName = String(question.tipe || 'Lainnya');
      if (!typeStats[typeName]) typeStats[typeName] = { total: 0, correct: 0, wrong: 0, correctNumbers: [], wrongNumbers: [] };
      typeStats[typeName].total++;
      if (isCorrect) { typeStats[typeName].correct++; typeStats[typeName].correctNumbers.push(index + 1); }
      else { typeStats[typeName].wrong++; typeStats[typeName].wrongNumbers.push(index + 1); }

      if (isTeacherScoredShortAnswer) resultLabel = 'Dinilai guru — ' + (isCorrect ? 'Benar' : 'Salah');
      else if (isPrintAnswerEmpty_(answer)) resultLabel = 'Tidak dijawab';
      else if ((question.tipe === 'Benar Salah' || question.tipe === 'Sesuai Tidak Sesuai') && (!Array.isArray(answer) || answer.length !== 3 || answer.some(function (v) { return question.tipe === 'Benar Salah' ? !normalizeBenarSalahValue_(v) : !normalizeSesuaiValue_(v); }))) resultLabel = 'Belum lengkap';
      else resultLabel = isCorrect ? 'Benar' : 'Salah';
    }

    var subDetails = [];
    if (question.tipe === 'Benar Salah' || question.tipe === 'Sesuai Tidak Sesuai') {
      var studentArray = Array.isArray(answer) ? answer : [];
      var keyArray = Array.isArray(key) ? key : [];
      (question.opsi || []).slice(0, 3).forEach(function (statement, statementIndex) {
        subDetails.push({ statement: SecurityService.sanitizeData(String(statement || '')), answer: (question.tipe === 'Benar Salah' ? normalizeBenarSalahValue_(studentArray[statementIndex]) : normalizeSesuaiValue_(studentArray[statementIndex])) || 'Belum dijawab', key: (question.tipe === 'Benar Salah' ? normalizeBenarSalahValue_(keyArray[statementIndex]) : normalizeSesuaiValue_(keyArray[statementIndex])) || '-' });
      });
    }
    questionReports.push({
      nomor: index + 1, id: question.id, tipe: question.tipe,
      pertanyaan: SecurityService.sanitizeHtml(question.pertanyaan || ''),
      jawaban: formatPrintAnswer_(question, answer), kunci: formatPrintKey_(question, key),
      hasil: resultLabel, skor: displayedScore, bobot: displayedMax, subDetails: subDetails
    });
  });

  var strengths = [], improvements = [];
  Object.keys(typeStats).forEach(function (typeName) {
    var stat = typeStats[typeName];
    var rate = stat.total ? stat.correct / stat.total : 0;
    var line = typeName + ': ' + stat.correct + ' dari ' + stat.total + ' soal benar';
    if (rate >= 0.75) {
      strengths.push(line + (stat.correctNumbers.length ? ' (nomor ' + stat.correctNumbers.join(', ') + ')' : ''));
    } else {
      improvements.push(line + (stat.wrongNumbers.length ? '; perlu ditinjau pada nomor ' + stat.wrongNumbers.join(', ') : ''));
    }
  });
  if (!strengths.length) strengths.push(objectiveCount ? 'Belum ada tipe soal dengan tingkat ketepatan minimal 75%; pertahankan latihan dan evaluasi jawaban.' : 'Belum tersedia soal objektif untuk menilai kelebihan secara otomatis.');
  if (!improvements.length) improvements.push(objectiveCount ? 'Tidak ditemukan tipe soal dengan tingkat ketepatan di bawah 75%. Pertahankan konsistensi belajar.' : 'Analisis kelemahan otomatis memerlukan soal objektif yang telah dikoreksi.');

  var objectiveScore100 = objectiveCount ? Math.round((objectiveCorrect / objectiveCount) * 10000) / 100 : 0;
  return {
    siswa: student, waktu: formatPrintTimestamp_(row[0]), mapel: mapelLabel,
    skorObjektif: Number(row[3]) || 0, skorEsai: Number(row[4]) || 0,
    nilaiAkhir: Number(row[5]) || 0,
    nilaiObjektif100: objectiveCount ? objectiveScore100 : null,
    jumlahBenar: objectiveCorrect, jumlahSalah: objectiveWrong,
    jumlahObjektif: objectiveCount, jumlahEsai: questions.filter(function (q) { return q.tipe === 'Esai'; }).length,
    skorEsaiRinci: essayEarned, bobotEsaiRinci: essayMax,
    kelebihan: strengths, perluDitingkatkan: improvements,
    status: String(row[6] || '-'), logPelanggaran: String(row[7] || 'Aman'),
    totalSoal: questionReports.length, skorRincian: calculatedScore,
    bobotRincian: calculatedMax, questions: questionReports
  };
}

function resolveQuestionsForPrint_(mapelLabel, context) {
  var all = context.allQuestions || [];
  if (mapelLabel.indexOf('Paket: ') === 0) {
    var packageName = mapelLabel.substring(7).trim();
    var targetPackage = (context.packages || []).find(function (p) { return String(p.nama_paket) === packageName; });
    if (targetPackage && Array.isArray(targetPackage.soal_ids)) {
      var ids = targetPackage.soal_ids.map(String);
      var byId = {};all.forEach(function(q){byId[String(q.id)]=q;});
      return ids.map(function(id){return byId[id];}).filter(Boolean);
    }
  }
  if (mapelLabel && mapelLabel !== '-') {
    var byMapel = all.filter(function (q) { return String(q.mapel || '') === mapelLabel; });
    if (byMapel.length) return byMapel;
  }
  return all;
}

function isPrintAnswerEmpty_(answer) {
  if (answer === null || typeof answer === 'undefined' || answer === '') return true;
  if (Array.isArray(answer)) return answer.length === 0 || answer.every(function (v) { return v === null || typeof v === 'undefined' || String(v).trim() === ''; });
  if (typeof answer === 'object') return Object.keys(answer).length === 0;
  return false;
}

function formatPrintAnswer_(question, answer) {
  if (isPrintAnswerEmpty_(answer)) return 'Tidak dijawab';
  if (question.tipe === 'PG Kompleks' && Array.isArray(answer)) return answer.join(' | ');
  if ((question.tipe === 'Benar Salah' || question.tipe === 'Sesuai Tidak Sesuai') && Array.isArray(answer)) return answer.map(function (v, i) { return 'P' + (i + 1) + ': ' + ((question.tipe === 'Benar Salah' ? normalizeBenarSalahValue_(v) : normalizeSesuaiValue_(v)) || 'Belum dijawab'); }).join('; ');
  if (question.tipe === 'Menjodohkan' && answer && typeof answer === 'object') return Object.keys(answer).map(function (k) { return k + ' → ' + answer[k]; }).join('; ');
  if (Array.isArray(answer)) return answer.join(' | ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
}

function formatPrintKey_(question, key) {
  if (key === null || typeof key === 'undefined' || key === '') return '-';
  if ((question.tipe === 'Benar Salah' || question.tipe === 'Sesuai Tidak Sesuai') && Array.isArray(key)) return key.map(function (v, i) { return 'P' + (i + 1) + ': ' + ((question.tipe === 'Benar Salah' ? normalizeBenarSalahValue_(v) : normalizeSesuaiValue_(v)) || '-'); }).join('; ');
  if (question.tipe === 'Menjodohkan' && key && typeof key === 'object') return Object.keys(key).map(function (k) { return k + ' → ' + key[k]; }).join('; ');
  if (Array.isArray(key)) return key.join(' | ');
  if (typeof key === 'object') return JSON.stringify(key);
  return String(key);
}
