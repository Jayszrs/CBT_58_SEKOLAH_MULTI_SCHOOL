
/**
 * =========================================================
 * CBT-GAS MASTER PRIBADI
 * AUTOMATIC GRADING SERVICE
 * =========================================================
 *
 * Fitur:
 * 1. Penilaian Pilihan Ganda
 * 2. Penilaian PG Kompleks
 * 3. Penilaian Menjodohkan
 * 4. Penilaian Benar Salah
 * 5. Koreksi manual Isian Singkat
 * 6. Koreksi manual Esai
 * 7. Penyimpanan detail skor Google Sheets
 * 8. Sinkronisasi hasil koreksi ke Firebase
 *
 * Dependensi:
 * - BenarSalahService.gs
 * - FirebaseDatabaseService
 * - SecurityService tidak diperlukan langsung di file ini.
 */


// =========================================================
// 1. NORMALISASI JAWABAN
// =========================================================

function normalizeGradingText_(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}


// =========================================================
// 2. MEMBANDINGKAN ARRAY
// =========================================================

function compareGradingArrays_(studentAnswer, answerKey) {

  if (
    !Array.isArray(studentAnswer) ||
    !Array.isArray(answerKey)
  ) {
    return false;
  }

  if (studentAnswer.length !== answerKey.length) {
    return false;
  }

  const studentValues = studentAnswer
    .map(normalizeGradingText_)
    .sort();

  const keyValues = answerKey
    .map(normalizeGradingText_)
    .sort();

  return studentValues.every(function(value, index) {
    return value === keyValues[index];
  });
}


// =========================================================
// 3. MEMBANDINGKAN OBJECT MENJODOHKAN
// =========================================================

function compareGradingObjects_(studentAnswer, answerKey) {

  if (
    !studentAnswer ||
    !answerKey ||
    typeof studentAnswer !== 'object' ||
    typeof answerKey !== 'object' ||
    Array.isArray(studentAnswer) ||
    Array.isArray(answerKey)
  ) {
    return false;
  }

  const studentKeys = Object.keys(studentAnswer).sort();
  const answerKeys = Object.keys(answerKey).sort();

  if (studentKeys.length !== answerKeys.length) {
    return false;
  }

  return answerKeys.every(function(key, index) {

    return (
      key === studentKeys[index] &&
      normalizeGradingText_(studentAnswer[key]) ===
      normalizeGradingText_(answerKey[key])
    );

  });
}


// =========================================================
// 4. PEMERIKSAAN JAWABAN OBJEKTIF
// =========================================================

function checkObjectiveAnswer_(question, studentAnswer) {

  const answerKey = question.kunci_jawaban;

  switch (question.tipe) {

    case 'PG':

      return (
        typeof studentAnswer === 'string' &&
        normalizeGradingText_(studentAnswer) ===
        normalizeGradingText_(answerKey)
      );


    case 'PG Kompleks':

      return compareGradingArrays_(
        studentAnswer,
        answerKey
      );


    case 'Menjodohkan':

      return compareGradingObjects_(
        studentAnswer,
        answerKey
      );


    case 'Sesuai Tidak Sesuai':
      return gradeSesuaiTidakSesuai(studentAnswer, answerKey);

    case 'Benar Salah':

      if (typeof gradeBenarSalah !== 'function') {
        throw new Error(
          'Fungsi gradeBenarSalah() tidak ditemukan. Periksa BenarSalahService.gs.'
        );
      }

      return gradeBenarSalah(
        studentAnswer,
        answerKey
      );


    default:

      throw new Error(
        'Tipe soal tidak dikenali: ' + question.tipe
      );

  }
}


// =========================================================
// 5. FUNGSI UTAMA PENILAIAN OTOMATIS
// =========================================================

function autoGrade(studentAnswers, questionBank) {

  if (
    !studentAnswers ||
    typeof studentAnswers !== 'object' ||
    Array.isArray(studentAnswers)
  ) {
    throw new Error(
      'Format data jawaban siswa tidak valid.'
    );
  }

  if (!Array.isArray(questionBank)) {
    throw new Error(
      'Bank soal tidak valid.'
    );
  }

  let skorObjektif = 0;
  let totalBobot = 0;
  let butuhKoreksiEsai = false;

  const detailSkor = {};

  questionBank.forEach(function(question) {

    const questionId = String(question.id);

    const bobot = Math.max(
      1,
      Number(question.bobot) || 1
    );

    totalBobot += bobot;

    const hasAnswer =
      Object.prototype.hasOwnProperty.call(
        studentAnswers,
        questionId
      );

    const studentAnswer = hasAnswer
      ? studentAnswers[questionId]
      : null;


    // Esai dan Isian Singkat dikoreksi manual.

    if (
      question.tipe === 'Esai' ||
      question.tipe === 'Isian Singkat'
    ) {

      butuhKoreksiEsai = true;

      detailSkor[questionId] = {
        tipe: question.tipe,
        jawaban_siswa: studentAnswer,
        bobot: bobot,
        skor: 0,
        status: 'Menunggu Koreksi'
      };

      return;
    }


    // Penilaian objektif.

    const isCorrect = checkObjectiveAnswer_(
      question,
      studentAnswer
    );

    const earnedScore = isCorrect ? bobot : 0;

    skorObjektif += earnedScore;

    detailSkor[questionId] = {
      tipe: question.tipe,
      jawaban_siswa: studentAnswer,
      bobot: bobot,
      skor: earnedScore,
      status: isCorrect ? 'Benar' : 'Salah'
    };

  });


  const nilaiAkhir = totalBobot > 0
    ? Number(
        ((skorObjektif / totalBobot) * 100).toFixed(2)
      )
    : 0;


  return {
    skorObjektif: skorObjektif,
    nilaiAkhir: nilaiAkhir,
    butuhKoreksiEsai: butuhKoreksiEsai,
    detailSkor: detailSkor
  };

}


// =========================================================
// 6. MEMBACA DETAIL SKOR DARI INPUT ADMIN
// =========================================================

function getIncomingEssayScore_(inputItem) {

  if (
    inputItem &&
    typeof inputItem === 'object' &&
    !Array.isArray(inputItem)
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        inputItem,
        'skor'
      )
    ) {
      return inputItem.skor;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        inputItem,
        'score'
      )
    ) {
      return inputItem.score;
    }

  }

  return inputItem;
}


// =========================================================
// 7. FUNGSI KOREKSI ESAI DAN ISIAN SINGKAT
// =========================================================

function saveEssayScore_(nisn, skor, detailSkor) {

  const nisnString = String(
    nisn == null ? '' : nisn
  ).trim();

  if (!/^[A-Za-z0-9_-]{1,40}$/.test(nisnString)) {

    return {
      success: false,
      message: 'NISN tidak valid.'
    };

  }


  // Membaca detail skor dari input admin.

  let incomingDetails = detailSkor;

  if (typeof incomingDetails === 'string') {

    try {

      incomingDetails = JSON.parse(
        incomingDetails
      );

    } catch (error) {

      return {
        success: false,
        message: 'Format detail skor tidak valid.'
      };

    }

  }


  if (
    !incomingDetails ||
    typeof incomingDetails !== 'object' ||
    Array.isArray(incomingDetails)
  ) {

    return {
      success: false,
      message: 'Data detail koreksi tidak valid.'
    };

  }


  const lock = LockService.getScriptLock();

  let lockAcquired = false;
  let firebasePayload = null;


  try {

    lock.waitLock(10000);
    lockAcquired = true;


    // Mengambil database Spreadsheet.

    const spreadsheet = getOrCreateSpreadsheet_();

    const sheet = spreadsheet.getSheetByName(
      'Respon_Jawaban'
    );

    if (!sheet || sheet.getLastRow() < 2) {

      return {
        success: false,
        message: 'Data jawaban siswa belum tersedia.'
      };

    }


    // Mencari pengiriman jawaban terakhir siswa.

    const lastRow = sheet.getLastRow();

    const rows = sheet.getRange(
      2,
      1,
      lastRow - 1,
      10
    ).getValues();

    let targetRow = -1;
    let targetData = null;

    for (let i = rows.length - 1; i >= 0; i--) {

      if (
        String(rows[i][1]).trim() === nisnString
      ) {

        targetRow = i + 2;
        targetData = rows[i];

        break;

      }

    }


    if (targetRow === -1) {

      return {
        success: false,
        message: 'Data jawaban siswa tidak ditemukan.'
      };

    }


    // Membaca detail skor sebelumnya.

    let savedDetails = {};

    try {

      savedDetails = targetData[8]
        ? (
            typeof targetData[8] === 'string'
              ? JSON.parse(targetData[8])
              : targetData[8]
          )
        : {};

    } catch (error) {

      return {
        success: false,
        message: 'Data detail skor sebelumnya rusak.'
      };

    }


    if (
      !savedDetails ||
      typeof savedDetails !== 'object' ||
      Array.isArray(savedDetails)
    ) {

      return {
        success: false,
        message: 'Struktur detail skor tidak valid.'
      };

    }


    const updatedDetails = JSON.parse(
      JSON.stringify(savedDetails)
    );

    const allQuestionIds = Object.keys(
      updatedDetails
    ).filter(function(questionId) { return questionId !== '__urutan_soal__'; });


    // Mengidentifikasi soal yang perlu dikoreksi.

    const essayIds = allQuestionIds.filter(
      function(questionId) {

        const item = updatedDetails[questionId];

        return (
          item &&
          (
            item.tipe === 'Esai' ||
            item.tipe === 'Isian Singkat'
          )
        );

      }
    );


    if (essayIds.length === 0) {

      return {
        success: false,
        message:
          'Tidak ditemukan soal Esai atau Isian Singkat. Pastikan detail skor sudah tersimpan.'
      };

    }


    // Menghitung total bobot seluruh soal.

    let totalWeight = 0;

    allQuestionIds.forEach(function(questionId) {

      const item = updatedDetails[questionId];

      const weight = Number(
        item && item.bobot
      );

      if (
        !Number.isFinite(weight) ||
        weight <= 0
      ) {

        throw new Error(
          'Bobot soal tidak valid: ' + questionId
        );

      }

      totalWeight += weight;

    });


    // Semua soal esai harus dikoreksi.

    let essayScoreTotal = 0;

    for (
      let i = 0;
      i < essayIds.length;
      i++
    ) {

      const questionId = essayIds[i];

      if (
        !Object.prototype.hasOwnProperty.call(
          incomingDetails,
          questionId
        )
      ) {

        return {
          success: false,
          message:
            'Skor soal ' + questionId +
            ' belum diberikan.'
        };

      }


      const rawScore = getIncomingEssayScore_(
        incomingDetails[questionId]
      );

      if (
        rawScore === null ||
        rawScore === undefined ||
        rawScore === ''
      ) {

        return {
          success: false,
          message:
            'Skor soal ' + questionId +
            ' belum valid.'
        };

      }


      const questionScore = Number(rawScore);

      const maximumScore = Number(
        updatedDetails[questionId].bobot
      );


      if (
        !Number.isFinite(questionScore) ||
        questionScore < 0 ||
        questionScore > maximumScore
      ) {

        return {
          success: false,
          message:
            'Skor soal ' + questionId +
            ' harus antara 0 sampai ' +
            maximumScore + '.'
        };

      }


      // Memperbarui detail skor.

      updatedDetails[questionId].skor =
        questionScore;

      updatedDetails[questionId].status =
        'Dikoreksi';

      essayScoreTotal += questionScore;

    }


    // Memastikan total skor sesuai dengan rincian.

    if (
      skor !== undefined &&
      skor !== null &&
      skor !== ''
    ) {

      const requestedScore = Number(skor);

      if (
        !Number.isFinite(requestedScore) ||
        Math.abs(
          requestedScore - essayScoreTotal
        ) > 0.01
      ) {

        return {
          success: false,
          message:
            'Total skor tidak sesuai dengan rincian koreksi.'
        };

      }

    }


    // Menghitung nilai akhir.

    const objectiveScore = Number(
      targetData[3]
    ) || 0;

    if (
      objectiveScore + essayScoreTotal >
      totalWeight + 0.001
    ) {

      return {
        success: false,
        message:
          'Total nilai melebihi bobot maksimal ujian.'
      };

    }


    const finalScore = Number(
      (
        (
          (objectiveScore + essayScoreTotal) /
          totalWeight
        ) * 100
      ).toFixed(2)
    );


    // Menyiapkan data penyimpanan.

    const detailJson = JSON.stringify(
      updatedDetails
    );


    // Memperbarui Google Sheets.
    // Kolom E = Skor Esai
    // Kolom F = Nilai Akhir
    // Kolom G = Status
    // Kolom I = Detail Skor

    sheet.getRange(
      targetRow,
      5,
      1,
      3
    ).setValues([[
      essayScoreTotal,
      finalScore,
      'Selesai'
    ]]);


    sheet.getRange(
      targetRow,
      9
    ).setValue(detailJson);


    SpreadsheetApp.flush();


    // Menghapus cache rekap nilai.

    CacheService.getScriptCache().remove(
      'REKAP_NILAI'
    );


    // Menyiapkan sinkronisasi Firebase.

    firebasePayload = {

      nisn_siswa: nisnString,

      skor_objektif: objectiveScore,

      skor_esai: essayScoreTotal,

      nilai_akhir: finalScore,

      detail_skor: updatedDetails,

      status_koreksi: 'Selesai'

    };


  } catch (error) {

    console.error(
      'Gagal menyimpan koreksi esai: ' +
      error.message
    );

    return {
      success: false,
      message:
        'Gagal menyimpan koreksi: ' +
        error.message
    };

  } finally {

    if (lockAcquired) {
      lock.releaseLock();
    }

  }


  // =======================================================
  // 8. SINKRONISASI FIREBASE
  // =======================================================

  try {

    const firebase =
      new FirebaseDatabaseService();

    const firebaseResult = firebase.patchData(
      'rekapan_hasil_ujian/' + nisnString,
      firebasePayload
    );


    if (!firebaseResult.success) {

      console.error(
        'Koreksi tersimpan di Sheets, tetapi Firebase gagal: ' +
        firebaseResult.message
      );

      return {

        success: true,

        firebaseSynced: false,

        skorEsai:
          firebasePayload.skor_esai,

        nilaiAkhir:
          firebasePayload.nilai_akhir,

        message:
          'Nilai tersimpan di Sheets. Sinkronisasi Firebase perlu diperiksa.'

      };

    }


    return {

      success: true,

      firebaseSynced: true,

      skorEsai:
        firebasePayload.skor_esai,

      nilaiAkhir:
        firebasePayload.nilai_akhir,

      message:
        'Koreksi esai berhasil disimpan.'

    };


  } catch (error) {

    console.error(
      'Gagal sinkronisasi Firebase: ' +
      error.message
    );

    return {

      success: true,

      firebaseSynced: false,

      skorEsai:
        firebasePayload.skor_esai,

      nilaiAkhir:
        firebasePayload.nilai_akhir,

      message:
        'Nilai tersimpan di Sheets, tetapi Firebase belum tersinkron.'

    };

  }

}

/**
 * PENILAIAN SOAL BENAR SALAH
 * Format: 3 pernyataan
 */
function gradeBenarSalah(jawabanSiswa, kunciJawaban) {

  if (
    !Array.isArray(jawabanSiswa) ||
    !Array.isArray(kunciJawaban)
  ) {
    return false;
  }

  if (
    jawabanSiswa.length !== 3 ||
    kunciJawaban.length !== 3
  ) {
    return false;
  }

  function normalizeValue(value) {
    const normalized = String(
      value == null ? '' : value
    ).trim().toLowerCase();

    if (
      normalized === 'benar' ||
      normalized === 'true'
    ) {
      return 'benar';
    }

    if (
      normalized === 'salah' ||
      normalized === 'false'
    ) {
      return 'salah';
    }

    return '';
  }

  for (let i = 0; i < 3; i++) {

    const answer = normalizeValue(
      jawabanSiswa[i]
    );

    const key = normalizeValue(
      kunciJawaban[i]
    );

    if (!answer || !key || answer !== key) {
      return false;
    }
  }

  return true;
}

function testGradingService_() {

  const questions = [
    {
      id: 'Q1',
      tipe: 'PG',
      kunci_jawaban: 'A',
      bobot: 2
    },
    {
      id: 'Q2',
      tipe: 'PG Kompleks',
      kunci_jawaban: ['A', 'C'],
      bobot: 3
    },
    {
      id: 'Q3',
      tipe: 'Menjodohkan',
      kunci_jawaban: {
        '1': 'A',
        '2': 'B'
      },
      bobot: 3
    },
    {
      id: 'Q4',
      tipe: 'Benar Salah',
      kunci_jawaban: ['Benar', 'Benar', 'Salah'],
      bobot: 4
    },
    {
      id: 'Q5',
      tipe: 'Esai',
      kunci_jawaban: '',
      bobot: 5
    },
    {
      id: 'Q6',
      tipe: 'Isian Singkat',
      kunci_jawaban: 'Jakarta',
      bobot: 3
    }
  ];

  const answers = {
    Q1: 'A',
    Q2: ['C', 'A'],
    Q3: {
      '1': 'A',
      '2': 'B'
    },
    Q4: ['Benar', 'Benar', 'Salah'],
    Q5: 'Jawaban esai siswa',
    Q6: 'Jakarta'
  };

  const result = autoGrade(answers, questions);

  Logger.log(JSON.stringify(result, null, 2));

  if (result.skorObjektif !== 12) {
    throw new Error('Tes skor objektif GAGAL.');
  }

  if (result.nilaiAkhir !== 60) {
    throw new Error('Tes nilai akhir GAGAL.');
  }

  if (!result.butuhKoreksiEsai) {
    throw new Error('Tes koreksi manual GAGAL.');
  }

  Logger.log('SEMUA TES GRADING BERHASIL.');

  return result;
}
function runGradingServiceTest() {
  return testGradingService_();
}
