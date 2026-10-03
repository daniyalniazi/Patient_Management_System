/*
 * Patient Records: config.js
 * Settings you are most likely to change: names, Excel columns and form fields.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= names and limits ================= */
const ROOT_NAME   = 'Patients data';        // folder the app creates inside the folder the user picks
const FILE_NAME   = 'PatientData.xlsx';     // the Excel file that holds all records
const DELETED_DIR = 'Deleted';              // deleted patients' folders and images move here
const BACKUP_DIR  = 'Backups';              // one copy of the Excel file per day
const RESET_FILE  = 'Delete this file to reset password.txt';  // deleting it allows a password reset
const PBKDF2_ITER = 200000;                 // password hashing strength (higher = slower to guess)
const CODE_CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';        // recovery code letters (no 0/O, 1/I)

/* ================= Excel columns =================
 * Each entry is [key, column header in Excel, column width].
 * - key:    the name used in the code and in the form fields below.
 * - header: what appears in row 1 of the Excel sheet. The app finds columns
 *           by this header, so renaming it breaks old files unless you also
 *           rename the header in those files.
 *
 * TO ADD A FIELD:
 *   1. Add a column here (PATIENT_COLS for patient details, VISIT_COLS for visits).
 *   2. Add a form field with the same key to PATIENT_FIELDS or VISIT_FIELDS below.
 *   That's all: forms, detail pages and the Excel file pick it up automatically.
 */
const PATIENT_COLS = [
  ['id','Unique ID',10], ['name','Full Name',24], ['father','Father/Husband Name',22], ['mother',"Mother's Name",18],
  ['cnic','CNIC',17], ['gender','Gender',9], ['dob','Date of Birth',13], ['phone','Phone',15], ['address','Address',30],
  ['emergency','Emergency Contact',24], ['allergy','Allergies',18],
  ['regDate','Registered Date',14], ['regTime','Registered Time',14], ['folder','Folder',28]   // filled in by the app
];
const VISIT_COLS = [
  ['id','Unique ID',10], ['name','Patient Name',24], ['visit','Visit #',8], ['date','Date',12], ['time','Time',10],  // filled in by the app
  ['age','Age',8], ['weight','Weight (kg)',11], ['symptoms','Symptoms/History/Condition',36], ['findings','Findings',30],
  ['treatment','Treatment',36], ['referral','Referral',20], ['outcome','Outcome/Progress',24], ['disposal','Final Disposal',16],
  ['enteredBy','Entered By',22], ['images','Images',50]   // images = file names separated by "; "
];
const DELETED_COL = ['deletedOn','Deleted On',20];   // extra column on the "Deleted ..." sheets

/* ================= form fields =================
 * Shown in the Add / Edit forms, in this order. Options:
 *   key          must match a key in the Excel columns above
 *   label        text shown above the input
 *   required     true = must be filled before saving (only the name is required now)
 *   type         'text' (default), 'textarea', 'select' or 'date'
 *   options      list of choices for type 'select' ('' = no choice)
 *   placeholder  grey hint text inside an empty input
 *   list         id of a <datalist> in index.html with suggestions
 *   wide         true = the field takes the full width of the form
 * The default fields follow the Punjab Healthcare Commission's suggested
 * format for patient clinical records (MSDS for clinics, Standard IMS-1).
 */
const PATIENT_FIELDS = [
  {key:'name',      label:'Full name', required:true},
  {key:'father',    label:'Father / husband name'},
  {key:'mother',    label:"Mother's name"},
  {key:'cnic',      label:'CNIC', placeholder:'12345-1234567-1'},
  {key:'gender',    label:'Gender', type:'select', options:['','Male','Female','Other']},
  {key:'dob',       label:'Date of birth', type:'date'},
  {key:'phone',     label:'Phone', placeholder:'03xx-xxxxxxx'},
  {key:'emergency', label:'Emergency contact (name & phone)'},
  {key:'allergy',   label:'Allergies'},
  {key:'address',   label:'Address', wide:true}
];
const VISIT_FIELDS = [
  {key:'age',       label:'Age'},
  {key:'weight',    label:'Weight (kg)'},
  {key:'enteredBy', label:'Entered by (name & designation)'},
  {key:'symptoms',  label:'Symptoms / history / condition', type:'textarea', wide:true},
  {key:'findings',  label:'Findings / provisional diagnosis', type:'textarea', wide:true},
  {key:'treatment', label:'Treatment / medicines advised', type:'textarea', wide:true},
  {key:'referral',  label:'Referral (if any)'},
  {key:'outcome',   label:'Outcome / progress'},
  {key:'disposal',  label:'Final disposal', list:'dl_disposal'}
];
