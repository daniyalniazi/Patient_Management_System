# Patient Records: User Guide

> **This app is free. Selling it is not allowed.** See the [license](../LICENSE).

## What Patient Records is

Patient Records is a free app for keeping clinic patient records on your own computer. It is a single file, Patient_Records.html, and needs no internet, account or installation.

- It works in Google Chrome or Microsoft Edge, on Windows and Mac. Safari and Firefox are not supported.
- Patient details and visits are saved in an Excel file. Each patient's images are kept in their own folder.
- The fields are based on the Punjab Healthcare Commission's suggested format for clinic records.

## Set up for the first time

1. Open Patient_Records.html in Chrome or Edge. On a Mac, right-click the file, choose Open With, then Chrome.
2. Create a password of at least 4 characters and type it again.
3. Write down the recovery code, or click Save as file. Tick "I have saved my recovery code", then click Continue. The code is shown only once.
4. Click Choose folder and pick where records should be kept, for example a folder named Clinic in Documents. The app makes a folder named Patients data inside it.
5. If the browser asks to let the page edit files, click Allow.

After this, enter your password each time you open the app. If the browser asks for folder access again, click Allow.

## Add a patient

1. Click + Add patient.
2. Type the full name. This is the only field you must fill.
3. Fill in any other details you have: father or husband name, mother's name, CNIC, gender, date of birth, phone, emergency contact, allergies and address.
4. Under First visit, fill in what you need: age, weight, entered by, symptoms, findings, treatment, referral, outcome and final disposal. The date and time are added automatically.
5. Click Choose images to add photos of the prescription or reports. You can pick several at once, and PDF files work too.
6. Click Save patient.

Each patient gets a Unique ID (0001, 0002 and so on) and their own folder. If the CNIC you type already belongs to another patient, the app warns you before saving.

Age fills in by itself from the date of birth. Entered by remembers the last name you typed on this computer.

## Find a patient

Type in the search box above the list. The list filters as you type, and the Search button does the same.

| What you type | What it finds |
| --- | --- |
| A name, like Ali | Patients whose first name starts with it (Ali, Alia) |
| Two or more words, like Ali Khan | Patients whose full name starts with them |
| 1 to 5 digits, like 12 or 0012 | The patient with that Unique ID |
| 6 or more digits | Patients whose CNIC or phone contains them |

Phone numbers match with or without +92, spaces or dashes.

## Record visits and view images

1. Click a patient in the list to open their page. It shows their details and every visit, newest first.
2. Click + Add visit, fill in what you need, choose images, then click Save visit. The visit number, date and time are added automatically.
3. Click a visit to open it. Its images show at the top, with the visit details below.
4. Click an image to see it full size. Use the arrows, or the left and right arrow keys, to move between images.
5. To add more images to a visit later, open the visit and click + Add images.

Images are copied into the patient's folder and renamed, for example 0001_Ali Khan_V2_29-09-2026.jpg (ID, name, visit number, date). The original files stay where they were.

## Edit or delete

- **Patient:** click ⋮ on their row in the list, or on their page, then choose Edit or Delete.
- **Visit:** open the visit, click ⋮, then choose Edit visit or Delete visit.

If you change a patient's name, the app renames their folder and image files to match.

Deleting never erases anything. A deleted patient's folder moves to the Deleted folder, and their rows move to the Deleted sheets of the Excel file. A deleted visit's images also move to the Deleted folder. Unique IDs and visit numbers are never reused.

## Where your data is kept

Everything is saved in the Patients data folder you chose:

```
Patients data
├── PatientData.xlsx
├── Ali Khan_0001
│   ├── 0001_Ali Khan_V1_29-09-2026_1.jpg
│   ├── 0001_Ali Khan_V1_29-09-2026_2.jpg
│   └── 0001_Ali Khan_V2_05-10-2026.jpg
├── Sara Ahmed_0002
├── Backups
├── Deleted
└── Delete this file to reset password.txt
```

PatientData.xlsx has four sheets: Patients, Visits, Deleted Patients and Deleted Visits. You can open it in Excel to read, filter or print, but close it before saving anything in the app.

Backups holds one copy of the Excel file per day, made before the first change that day. Deleted holds the folders and images of deleted patients and visits.

If you change the Excel file by hand, keep the column names as they are. Then, in the app, click Settings and then Reload from Excel.

## Your password

Each computer has its own password. It is saved in that computer's browser, not in the Patients data folder.

- **Change it:** click Settings, then Change password. Type your current password and the new one twice.
- **Get a new recovery code:** click Settings, then Make a new recovery code. The old code stops working.
- **Too many tries:** after 5 wrong passwords, the app makes you wait 30 seconds.

### If you forget your password

Click Forgot password? on the lock screen, then use either way:

1. **Recovery code:** type the code, click Check code, then set a new password.
2. **Data folder:** open the Patients data folder and delete the file named "Delete this file to reset password.txt". Back in the app, click I deleted the file, click Allow if the browser asks, then set a new password.

The reset file is made again after you set the new password. Deleting it never removes patient data.

## Use another computer

1. Copy Patient_Records.html to the other computer.
2. Make the Patients data folder reachable there: copy it across, or keep it on a USB drive or in a synced folder such as OneDrive or Google Drive.
3. Open the app, create a password for that computer, then choose the Patients data folder or the folder that holds it.

Use the same folder on only one computer at a time. If two computers save at once, one can overwrite the other's changes. With a synced folder, wait for syncing to finish before opening the app on the other computer.

## Start over

Click Settings, then Start over. The browser forgets the password, recovery code and folder on this computer, so the app opens as it did the first time.

Your patient data is kept, unless you also tick "Delete everything in the Patients data folder" and type DELETE. Only do that with test data, because it cannot be undone.

## Privacy and safety

Patient data never leaves your computer: the app sends nothing over the internet. The password only locks the app screen, so anyone who can open the Patients data folder can read the Excel file and see the images.

- Protect the computer with its own user account and password.
- Turn on disk encryption if your computer has it: BitLocker or Device Encryption on Windows, FileVault on Mac.
- Copy the Patients data folder to a USB drive or another safe place at least once a week. The daily backups sit on the same disk, so they will not help if the computer is lost or broken.
- Check your own legal duties for keeping records. The Punjab Healthcare Commission asks clinics to keep general records for at least 1 year, and medico-legal records for 12 years or longer.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The app says it needs Chrome or Edge | Open the file in Google Chrome or Microsoft Edge. |
| Saving fails and mentions the Excel file | Close PatientData.xlsx in Excel, then save again. |
| The browser asks for folder access | Click Allow. It asks again after the browser restarts. |
| The browser won't let you pick a folder because of system files | Make or pick an ordinary folder, such as Clinic in Documents. |
| An image shows "File not found" | It was moved or renamed outside the app. Put it back in the patient's folder with the same name. |
| Changes made in Excel don't show | Click Settings, then Reload from Excel. |
| You forgot the password | Click Forgot password? on the lock screen. |
