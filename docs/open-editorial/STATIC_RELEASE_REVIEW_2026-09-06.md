# Независимая проверка статического выпуска · 6 сентября 2026

Автор разрешил публикацию манифеста и доступной механики без сервера участия. Этот отчёт относится к отдельному статическому выпуску. Предыдущая приёмка backend/R1 не является его сертификатом и не требует открывать серверные функции ради этой публикации.

Граница выпуска: чтение книги и неизменного манифеста; опубликованный корпус для собственного ИИ; личные заметки в текущем профиле браузера; подготовка замечания с исходной редакцией/блоком/проверенной цитатой; явное копирование или скачивание локального черновика. Сохранение файла не означает получение редакцией, receipt, модерацию или принятие правки.

## Критерии готовой сборки

| ID | Инвариант | Проверяемое доказательство |
|---|---|---|
| SR01 | Статический режим является default, случайный API_URL его не включает | Build fixture с API_URL, но без connected mode; api_root=null, auth/registration отсутствуют, capabilities записи false |
| SR02 | Все объявленные машинные действия существуют как публичные файлы | GET-only static OpenAPI без bearer/security схем и серверных операций; все file URLs разрешаются внутри опубликованного origin/base path |
| SR03 | Книга, манифест и исходная привязка сохранены | SHA-256 оригинала; canonical text/hash, уникальные IDs и immutable snapshots; замечание не переносится молча на другую редакцию |
| SR04 | Локальный черновик — данные, а не фиктивная отправка | Чистый validator проверяет принадлежность/hash/quote; JSON/Markdown не получают owner token, consent, receipt или статус принятого вклада |
| SR05 | Личные записи не отправляются и не оказываются в URL | Только localStorage/sessionStorage; transfer URL содержит UUID и публичные IDs, без текста заметки; clipboard/download только явным действием; native form не сериализует личные поля в query |
| SR06 | Прямой URL не открывает неподдерживаемое действие | Девять активных маршрутов; retired страницы допускают только read-only объяснение, без login/OTP/отправки/ключей/admin controls; навигация не ведёт к неработающим разделам |
| SR07 | Сборка воспроизводится без сервиса и приватных материалов | Минимальный generator fixture без service/node_modules; чистый release checkout, npm ci/build/export checks; в out нет DB, .env, токенов, приватного пакета или служебных review traces |
| SR08 | Проверка не выдаёт предположение за наблюдение | Локальная сборка/HTTP и browser проверка помечены отдельно; deployment подтверждается фактическим CI/публичным URL интегратора |

Активные маршруты: /open-editorial/, /manifesto/, /manifesto/history/, /participate/, /me/, /agents/, /agents/guide/, /privacy/, /rules/ внутри раздела открытой редакции. Страница /me/ в данном выпуске — личные заметки браузера, не аккаунт. Корневые маршруты книги сохраняются.

## Первоначально выявленные границы

Исходная комбинация «API не настроен» скрывала запись, но продолжала рекламировать серверные действия: generator копировал service OpenAPI и guide, discovery указывал owner-issued bearer и registration URL, навигация вела к обсуждениям/задачам, страницы показывали вход, согласия и отключённую отправку. Для статического выпуска недостаточно выключить POST: UI и машинная документация должны описывать фактически доступные действия. Исправление проверено по исходникам и файлам: static mode не подключает provider; активные компоненты импортируют local-only helper; generator создаёт отдельные readonly guide и GET-only OpenAPI. Условные connected imports остаются для отдельного будущего режима, но не активируются в этом выпуске.

Локальная заметка доступна всем, кто пользуется тем же профилем браузера. Очистка данных может её удалить. Clipboard и скачанный файл переходят под обычный контроль устройства; сайт не обещает их приватность после передачи. Статический хост получает обычные запросы страниц и опубликованных файлов; утверждение «без сервера участия» не означает отсутствие сетевого чтения сайта.

Неподдерживаемая или неоднозначная цитата должна остановить точный экспорт либо явно перейти к блоку/главе. Ошибка localStorage, clipboard или скачивания не должна очищать введённый текст и не должна сообщать об успешном сохранении. В query/referrer не передаются message, quote, note, email или credentials.

## Зависимости чистого checkout

Для generator нужны Node 24, scripts/build-open-editorial.mjs, shared/open-editorial-text.mjs и open-editorial-layers.mjs, src/lib/site-config.ts с src/data/site-copy.json, опубликованный src/data/book.json, исходный docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md, CONSTITUTION.md, block-identities.json, STATIC_AGENT_GUIDE.md и уже опубликованные immutable public/editorial/editions. Static OpenAPI строится самим генератором; новых runtime imports для него не добавлено. Pure draft validator/serializer лежит в shared/open-editorial-draft.mjs с декларацией типов.

Для сайта нужны обычные package.json/package-lock, Next/React исходники и локальные assets/fonts существующего опубликованного reader. Генератор использует native TypeScript Node 24; прежний Node20 для этого пути недостаточен. Backend service, SQLite, Supabase, Python API clients, .runtime, локальная конфигурация, source-pack и прежние полные service-audit документы не являются runtime-зависимостями статической сборки. CI статического выпуска не должен требовать эти непубликуемые файлы.

## Фактическая проверка

Проверены рабочие исходники и отдельный чистый release checkout от опубликованной базы 9d2878e. Backend и source-pack в чистом checkout отсутствуют. Package scripts и GitHub Actions используют Node 24, NEXT_PUBLIC_EDITORIAL_MODE=static и NEXT_PUBLIC_BASE_PATH=/right-to-decide. Активный локальный helper выполняет только GET публичного /editorial/corpus.json; личные данные не включаются в этот запрос. Полные backend-тесты для этой проверки не запускались.

| Проверка | Фактический результат |
|---|---|
| node --test scripts/test-open-editorial-static.mjs | PASS 6/6 в рабочем каталоге и отдельно в clean checkout; около 11,1 с и 7,8 с соответственно |
| node --test scripts/test-open-editorial.mjs | PASS 5/5 в clean checkout; канонический текст, grapheme, источники и слои |
| Минимальный generator fixture | PASS: отдельное дерево без service/node_modules, случайный API_URL не включает connected, generator и --check дают согласованный корпус/guide/spec |
| Draft pure helper | PASS: faithful Unicode target; отказ при чужом ID/hash, повторе цитаты и разрезанном grapheme; fixed local_draft и allowlist без credentials/receipt/consent; входные объекты не меняются |
| Проверка исходников static UI | PASS в границах source review: локальные imports, UUID transfer, отсутствие name у личных полей, явные copy/download, catch ошибок хранения/скачивания, отсутствие ложного подтверждения получения редакцией |
| TypeScript и lint | PASS в полном clean npm run check; интерфейс и собственные test/validator/scanner scripts также прошли отдельные targeted проверки |
| Проверка источников книги в clean checkout | PASS: 8 manuscript и6 DOCX проверок; исходный текст не менялся этой механикой |
| Полный clean npm run check | PASS, exit0 на базе 9d2878e: source 8+6, lint, typecheck, content 18/18, static 11/11, Next build 121 страница и оба export validators |
| Проверка готового out | PASS: 96 старых маршрутов; 9 активных страниц и 7 readonly notices; 92 блока манифеста; 8 GET paths; 868 файлов, 0 private artifacts. Отдельный scanner: 868 файлов и 1 рабочий trace, 0 findings |
| GitHub build/deploy после rebase | PENDING на момент записи: локально проверена база 9d2878e; удалённая база обновилась до de49cc7. После rebase CI повторяет полный gate до deploy. Разрешение автора на публикацию есть; локальный PASS не приписан ещё не выполненному CI новой базы |
| Реальный браузер, clipboard/download/localStorage gestures,360px/200%,keyboard | BLOCKED в среде этой сессии: Windows kernel sandbox helper_sandbox_lock_failed / SetNamedSecurityInfoW5 до инициализации браузера. Эти проверки не заменены чтением кода или старыми скриншотами |

Windows Node 24.14.1 падал нативно внутри fs.cpSync при копировании небольшого fixture (86 файлов, примерно 4 MB). Тестовый обход каталога заменён на readdirSync/mkdirSync/copyFileSync; тот же минимальный checkout, обе генерации и сравнения прошли. Это изменение test harness, а не приложение и не ослабление проверок.

Рабочий журнал полного clean прогона: docs/open-editorial/verification/static-release-check.txt в изолированном release checkout. Этот журнал не входит в публичный out. Проверка готового артефакта воспроизводится так:

```powershell
$env:NEXT_PUBLIC_EDITORIAL_MODE = 'static'
$env:NEXT_PUBLIC_BASE_PATH = '/right-to-decide'
npm run editorial:static:check
npm run build
npm run check:export
npm run check:editorial-export
```

В release scripts editorial:static:test включает оба набора (5+6); editorial:static:check дополнительно проверяет воспроизводимость generator. check:editorial-export запускает [static validator](../../scripts/validate-open-editorial-export.mjs) и [artifact scanner](../../scripts/scan-open-editorial-artifacts.mjs). Валидатор требует 9 активных страниц и 7 readonly notices, marker static, корректные base links, отсутствие login/серверных действий/личных query fields и ссылок на неработающие workflows, 92 неизменных блока манифеста, 8 GET paths и локальные client action markers. Scanner создаёт свою папку отчёта сам, поэтому не зависит от старых журналов. Приватные/service документы и рабочие test traces не включаются в out.

GitHub workflow запускает полный npm run check до upload-pages-artifact; deploy зависит от успешного build job. Неудача теста, lint, сборки или export validation блокирует автоматическую публикацию. Передача подготовленного коммита в этот pipeline не считается уже состоявшимся deploy.

В проверенных исходниках, шести целевых тестах и полном локальном release pipeline не осталось блокирующего замечания для выбранного статического объёма. Локальный артефакт прошёл static и privacy guards. Это заключение не объявляет ещё не завершённый CI после rebase или фактический deploy успешными. Отсутствие browser runtime остаётся явной границей доказательств и не превращается в новое требование повторного разрешения автора на уже разрешённую публикацию.
