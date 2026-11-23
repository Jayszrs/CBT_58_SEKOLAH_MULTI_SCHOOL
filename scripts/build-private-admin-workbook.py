import os,sys,json,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
private=Path(os.environ['LOCALAPPDATA'])/'CBT58-QA'/'admin-credentials'
sys.path.insert(0,str(private/'python-deps'))
import xlsxwriter
manifest=json.loads((private/'manifest.json').read_text(encoding='utf-8'))
qa=json.loads(Path('reports/school-admin-login-qa.json').read_text(encoding='utf-8'))
tested={r['school']:r for r in qa['results']}
if len(manifest)!=58 or any(not tested.get(r['school_code'],{}).get('passed') for r in manifest):
    raise SystemExit('QA seluruh 58 admin harus lulus sebelum daftar dibagikan.')
dest=private/'AKUN-ADMIN-CBT-58-SEKOLAH-PRIVAT.xlsx'
book=xlsxwriter.Workbook(str(dest),{'strings_to_formulas':False,'strings_to_urls':False})
sheet=book.add_worksheet('AKUN ADMIN SEKOLAH')
title=book.add_format({'font_name':'Arial','font_size':14,'bold':True,'font_color':'#142032'})
note=book.add_format({'font_name':'Arial','font_size':10,'font_color':'#536174','text_wrap':True,'valign':'top'})
header=book.add_format({'font_name':'Arial','font_size':10,'bold':True,'bg_color':'#E8EEF7','text_wrap':True,'valign':'vcenter','bottom':1,'bottom_color':'#BDCADD'})
text=book.add_format({'font_name':'Arial','font_size':10,'text_wrap':True,'valign':'vcenter'})
pw=book.add_format({'font_name':'Arial','font_size':10,'num_format':'@','valign':'vcenter'})
link=book.add_format({'font_name':'Arial','font_size':10,'font_color':'#174BBB','underline':1,'valign':'vcenter'})
sheet.hide_gridlines(2)
sheet.merge_range('A2:I2','AKUN ADMIN CBT 58 SEKOLAH — PRIVAT',title)
sheet.merge_range('A3:I3','Username seluruh sekolah: admin. Password mengikuti lampiran pengguna. Simpan berkas ini privat; bagikan hanya baris sekolah yang bersangkutan.',note)
sheet.set_row(2,30)
headers=['No','Kode Sekolah','Nama Sekolah','Username','Password Admin','Link Login Admin','Spreadsheet Sekolah','Akun Pemilik','Status Pengujian']
sheet.write_row(4,0,headers,header);sheet.set_row(4,30)
for i,r in enumerate(manifest):
    row=i+5;sheet.write_number(row,0,i+1,text)
    for col,key in [(1,'school_code'),(2,'school_name'),(3,'username')]:sheet.write_string(row,col,r[key],text)
    sheet.write_string(row,4,r['password'],pw)
    sheet.write_url(row,5,r['webapp'],link,'Buka Login Admin')
    sheet.write_url(row,6,r['spreadsheet'],link,'Buka Spreadsheet')
    sheet.write_string(row,7,r['account_email'],text)
    sheet.write_string(row,8,'Lulus: login + aksi admin + penolakan akses salah',text)
    sheet.set_row(row,34)
sheet.set_column('A:A',5);sheet.set_column('B:B',13);sheet.set_column('C:C',32);sheet.set_column('D:D',12);sheet.set_column('E:E',44);sheet.set_column('F:G',23);sheet.set_column('H:H',32);sheet.set_column('I:I',37)
sheet.freeze_panes(5,3);sheet.autofilter(4,0,62,8);sheet.set_landscape();sheet.fit_to_pages(1,0);sheet.repeat_rows(4,4);sheet.print_area(0,0,62,8)
book.close()
with zipfile.ZipFile(dest) as z:
    ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    shared=ET.fromstring(z.read('xl/sharedStrings.xml'));strings=[''.join(si.itertext()) for si in shared]
    data=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    cells={c.attrib['r']:strings[int(c.find('s:v',ns).text)] for c in data.findall('.//s:c[@t="s"]',ns)}
    for i,r in enumerate(manifest):
        assert cells['E'+str(i+6)]==r['password']
        assert cells['B'+str(i+6)]==r['school_code']
print(json.dumps({'path':str(dest),'rows':58,'passwords_verified':58}))
