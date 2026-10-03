# Patient Records: developer guide

This page is for people who want to read or change the code. If you just want to use the app, see the [README](README.md).

Patient Records is a single offline HTML file. It saves patient records in an Excel file and images in folders on the user's computer, using only browser features. There is no server and no network access.

## How it works

| Part | How |
| --- | --- |
| Folder access | The [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API) (`showDirectoryPicker`) reads and writes the folder the user picks. Its handle is kept in IndexedDB, so the app can reconnect next time. This API is why only Chrome and Edge are supported. |
| Excel file | [SheetJS Community Edition](https://sheetjs.com) reads and writes `.xlsx`. Every change re-reads the file, applies the change and writes it back, after a once-a-day backup copy. |
| Password | Hashed with PBKDF2-SHA256 (200,000 rounds, random salt) and stored in the browser's IndexedDB. The recovery code is hashed the same way. |
| Network | None. The app makes no network requests. |

## Project structure

```
patient-records/
├── dist/Patient_Records.html   The ready-to-use app (made by build.py)
├── src/
│   ├── index.html    Page layout: lock screen, folder setup, app screens, dialogs
│   ├── styles.css    All styles. Colours are set once at the top
│   ├── config.js     Folder and file names, Excel columns, form fields  ← start here
│   ├── core.js       Shared state, helpers, IndexedDB, password hashing
│   ├── storage.js    Folder and file access, images, reading and writing Excel
│   ├── ui.js         Toasts, menus, dialogs, form fields, image picker
│   ├── records.js    Patients and visits, search, the three screens, image viewer
│   ├── settings.js   Settings dialog, choosing the folder, help page text
│   └── main.js       Lock screen, app-wide events, start-up (loads last)
├── vendor/           SheetJS library and its license
├── docs/             User guide and screenshots
├── build.py          Combines src/ and vendor/ into dist/Patient_Records.html
├── LICENSE           Patient Records Free Use License 1.0 (no selling)
├── README.md         For users, in English (README.ur.md is Urdu)
└── DEVELOPERS.md     This page
```

## Making your own version

1. Open `src/index.html` in Chrome or Edge. Edit the files in `src/`, then reload the page to see your changes.
2. When you're happy, run `python3 build.py` (Python 3.7+, no extra packages). It writes the single-file app to `dist/Patient_Records.html`.

The scripts are plain `<script>` tags, not ES modules, because Chrome blocks modules on pages opened from a local file. They share global names, so the load order in `index.html` matters.

### Common changes

| To change | Edit |
| --- | --- |
| Add, remove or rename a field | `config.js`: add it to the Excel columns list and the form fields list, with the same key |
| Colours | `:root` at the top of `styles.css` |
| Folder or file names | Top of `config.js`. Changing `FILE_NAME` or column headers means existing data files won't be found or read |
| Help page text | `HELP_HTML` in `settings.js` |
| Translation | Labels in `config.js`, and text in `index.html`, `settings.js` and `main.js` |

## Data format

`PatientData.xlsx` has four sheets: **Patients**, **Visits**, **Deleted Patients** and **Deleted Visits**. Columns are defined in `config.js` and found by their header names. The Visits sheet links to patients by **Unique ID**, and its **Images** column lists file names separated by `; `.

```
Patients data/
├── PatientData.xlsx
├── <Name>_<ID>/                     One folder per patient
│   └── <ID>_<Name>_V<visit>_<DD-MM-YYYY>[_<n>].<ext>
├── Backups/PatientData_<YYYY-MM-DD>.xlsx
├── Deleted/
└── Delete this file to reset password.txt
```

## Security and privacy

- The password only locks the app screen. The Excel file and images are not encrypted, so anyone who can open the folder can read them. Users should protect the computer itself with an account password and disk encryption.
- Each browser profile stores its own password hash, so each computer has a separate password.
- Deleting the reset file in the data folder allows a password reset. This is deliberate: anyone who can delete that file can already read the data.
- Chrome and Edge keep browser storage for all local files under one shared `file://` origin. Other local HTML files opened in the same browser profile can therefore see this app's browser storage.

## Browser support

Chrome or Edge, version 86 or newer, on Windows, Mac or Linux. Safari, Firefox and mobile browsers don't support the folder access this app needs.

## Limitations

- Only one computer should use the same data folder at a time. There is no file locking.
- `PatientData.xlsx` must be closed in Excel while the app saves.
- Search covers names, IDs, CNIC and phone, not visit notes.

## Third-party code

`vendor/xlsx.mini.min.js` is SheetJS Community Edition 0.18.5, licensed under Apache 2.0 (`vendor/LICENSE-SheetJS.txt`). It is the last version published on npm. Published security advisories affect how this version reads specially crafted spreadsheet files. The app only reads its own `PatientData.xlsx`, but upgrading is recommended: download a newer build from [cdn.sheetjs.com](https://cdn.sheetjs.com), replace the file in `vendor/` and run `build.py`.

## Contributing

Issues and pull requests are welcome. Please keep the app working as a single offline file with no network requests, and test your change in Chrome before sending it. By sending a contribution, you agree that it is shared under the same license as this project.

## License

Copyright (C) 2026 Daniyal. Licensed under the Patient Records Free Use License 1.0. See [LICENSE](LICENSE).

In short: anyone may use, copy and change the app for free, including private clinics. Nobody may sell it, charge for it (including for installing, supporting or hosting it), or include it in a paid product or service. Changed versions must be shared free of charge, under the same license, with their full source code.

This is not an OSI-approved open source license, because it does not allow selling. The SheetJS library in `vendor/` keeps its own Apache 2.0 license.
