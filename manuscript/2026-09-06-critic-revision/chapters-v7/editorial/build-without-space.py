from pathlib import Path
import json,re,hashlib
root=Path('right-to-decide-site/manuscript/2026-09-06-critic-revision')
ed=root/'chapters-v7/editorial'
records=json.loads((ed/'without-space-input.json').read_text(encoding='utf-8'))
# Удаляются целые абзацы, в том числе смешанные: никаких дописанных связок.
remove={
 'prologue':{17}, 'chapter-01':set(range(15,22)), 'chapter-02':{15},
 'chapter-05':set(range(2,13))|{15,16}, 'chapter-06':{7,8,9,18},
 'chapter-09':{22}, 'chapter-10':{3,4,5,6,8,9,10,12,13,14,19},
 'chapter-11':set(range(2,10)), 'chapter-12':{3,4,5,6,7,12,13,14,15,16},
 'chapter-17':set(range(12,19))|{27}, 'epilogue':{2,5}}
header='''# Проверочная проекция: книга без космического примера

Дата: 2026-09-06. Служебный материал для проверки самостоятельности аргументации по конституции. Это не читательская версия и не публикация. Исходные главы не менялись.

Из текста механически исключены целые абзацы конкретной ветви WATER и связанные с ними операционные продолжения, включая смешанные абзацы с общим выводом. Новых фраз и соединительных переходов нет. Общие рассуждения об инфраструктуре, машинной программе, собственности и образовании сохранены там, где они не требуют предположений о космическом снабжении. Изучение астрономии как обычный пример личного интереса не относится к WATER. Примечания вынесены из чтения; они остаются в исходниках и отдельно отмечены в карте. Номера ссылок сохранены. Отсутствующие переходы здесь следы удаления, а не предложенная литературная форма.

Карта исключений и SHA256 всех исходников: `without-space-map.md`; машиночитаемый вход: `without-space-input.json`. Идентификатор pNNN — номер абзаца между пустыми строками, включая заголовки.

'''
out=[header]; mapped=['# Карта исключений для book-without-space.md\n\nДата: 2026-09-06. Смысловая разметка выполнена вручную после чтения контекста; поиск слов использован лишь для первоначальных кандидатов. Удалены целые абзацы без переписывания оставшихся.\n']; manifest=[]
wc=lambda s:len(re.findall(r"[\w]+(?:[-’'][\w]+)*",s))
oldn=newn=0
for rec in records:
 f=Path(rec['file']); stem=f.stem
 now=hashlib.sha256(f.read_bytes()).hexdigest()
 if now!=rec['sha256']: raise SystemExit('Исходник изменился: '+str(f))
 mapped.append(f"\n## {stem}\n\nИсточник: `{f}`\n\nSHA256: `{now}`\n")
 excluded=[];noteids=[]
 for i,p in enumerate(rec['paragraphs'],1):
  if p['notes']: noteids.append(p['id']);continue
  oldn+=wc(p['text'])
  if i in remove.get(stem,set()):
   excluded.append({'id':p['id'],'reason':'Космический фрагмент или связанное операционное продолжение; смешанный общий вывод также удалён.','text':p['text']})
  else:
   out.append(f"<!-- {p['id']} -->\n\n{p['text']}\n\n")
   newn+=wc(p['text'])
 if excluded:
  for p in excluded:
   mapped.append(f"\n- **{p['id']}** — {p['reason']} Начало: «{p['text'][:155].replace(chr(10),' ')}…»\n")
 else: mapped.append('\nСодержательные космические фрагменты не исключались.\n')
 if noteids:mapped.append('\nПримечания вне непрерывного чтения (сохранены в исходнике): '+', '.join(noteids)+'.\n')
 manifest.append({'file':str(f),'sha256':now,'excluded':excluded,'notes_omitted':noteids})
(ed/'book-without-space.md').write_text(''.join(out),encoding='utf-8')
(ed/'without-space-map.md').write_text(''.join(mapped),encoding='utf-8')
(ed/'without-space-manifest.json').write_text(json.dumps({'words_before':oldn,'words_after':newn,'files':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(records),'excluded_prose_paragraphs':sum(len(x['excluded']) for x in manifest),'words_before':oldn,'words_after':newn,'projection_sha256':hashlib.sha256((ed/'book-without-space.md').read_bytes()).hexdigest()},ensure_ascii=False))
