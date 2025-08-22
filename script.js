// --- CONFIGURATION ---
const CLIENT_ID = '53198014929-ukavfd14a6p17a43c8n9en6qdb4tdpha.apps.googleusercontent.com';
const SHEET_ID = '1TPt4IN3zAstf1v04gKnNA_YueyTwEpsHtmWfgvFU9Gk';
const SHEET_NAME = 'Plans';
const PIGEON_SHEET = 'PigeonRank';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let plans = [];
let pigeonCounts = { '😈': 0, '🐧': 0, '🧊': 0, '💭': 0 };

// --- DOM ELEMENTS ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const planForm = document.getElementById('plan-form');
const planListTbody = document.getElementById('plan-list');
const pigeonTbody = document.getElementById('pigeon-rank');

let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- INITIALIZATION ---
window.onload = () => {
  gapi.load('client', initializeGapi);
  initializeGis();
  planForm.addEventListener('submit', handleFormSubmit);
};

// --- GAPI 初始化 ---
function initializeGapi() {
  gapi.client.init({
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
  }).then(() => {
    gapiInited = true;
    maybeEnableButtons();
  });
}

// --- GIS 初始化 ---
function initializeGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error(resp);
        return;
      }
      updateSigninStatus(true);
    }
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    loginBtn.style.display = 'block';
    loginBtn.onclick = () => {
      tokenClient.requestAccessToken({prompt: 'consent'});
    };
  }
}

// --- SIGN IN / SIGN OUT ---
function updateSigninStatus(signedIn) {
  loginBtn.style.display = signedIn ? 'none' : 'block';
  logoutBtn.style.display = signedIn ? 'block' : 'none';
  if (signedIn) {
    loadPlans();
    loadPigeonCounts();
  } else {
    planListTbody.innerHTML = '';
    pigeonTbody.innerHTML = '';
  }
}

logoutBtn.onclick = () => {
  gapi.client.setToken(null);
  updateSigninStatus(false);
};

// --- FORM SUBMIT ---
async function handleFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('date').value;
  const restaurant = document.getElementById('restaurant').value;
  const note = document.getElementById('note').value;
  const participants = Array.from(document.querySelectorAll('input[name="members"]:checked')).map(cb=>cb.value);
  const initiator = participants[0]||'';

  const newPlan = [date, restaurant, initiator, participants.join(','), '否', note];

  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newPlan] }
    });
    planForm.reset();
    document.querySelectorAll('input[name="members"]').forEach(cb=>cb.checked=false);
    alert('✅ Plan added!');
    await loadPlans();
  } catch(err){ console.error(err); alert('Failed to add plan'); }
}

// --- LOAD DATA ---
async function loadPlans() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:F`
    });
    const rows = res.result.values||[];
    plans = rows.map((r,i)=>({
      rowIndex:i+2,
      date:r[0]||'',
      restaurant:r[1]||'',
      initiator:r[2]||'',
      participants:r[3]?r[3].split(','):[],
      done:r[4]==='是',
      note:r[5]||''
    }));
    renderPlans();
  } catch(err){ console.error(err); }
}

async function loadPigeonCounts() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PIGEON_SHEET}!A2:B`
    });
    const rows = res.result.values||[];
    pigeonCounts = {};
    rows.forEach(r=>pigeonCounts[r[0]] = parseInt(r[1]||0,10));
    renderRank();
  } catch(err){ console.error(err); }
}

// --- PLAN OPERATIONS ---
async function toggleDone(index) {
  plans[index].done = !plans[index].done;
  await updatePlanRow(index);
}

async function updateNote(index, value) {
  plans[index].note = value;
  await updatePlanRow(index);
}

async function updatePlanRow(index) {
  const p = plans[index];
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId:SHEET_ID,
      range:`${SHEET_NAME}!A${p.rowIndex}:F${p.rowIndex}`,
      valueInputOption:'USER_ENTERED',
      resource:{ values:[[p.date,p.restaurant,p.initiator,p.participants.join(','),p.done?'是':'否',p.note]] }
    });
  } catch(err){ console.error(err); }
}

async function deletePlan(index){
  if(!confirm('Are you sure to delete?')) return;
  const p = plans[index];
  try {
    const sheetInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId:SHEET_ID });
    const sheetId = sheetInfo.result.sheets.find(s=>s.properties.title===SHEET_NAME).properties.sheetId;
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId:SHEET_ID,
      resource:{ requests:[{ deleteDimension:{ range:{ sheetId, dimension:'ROWS', startIndex:p.rowIndex-1, endIndex:p.rowIndex } } }] }
    });
    await loadPlans();
  } catch(err){ console.error(err); }
}

// --- PIGEON ---
async function incrementPigeon(name){
  pigeonCounts[name] = (pigeonCounts[name]||0)+1;
  renderRank();
  try {
    const rowIndex = Object.keys(pigeonCounts).indexOf(name)+2;
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId:SHEET_ID,
      range:`${PIGEON_SHEET}!B${rowIndex}`,
      valueInputOption:'USER_ENTERED',
      resource:{ values:[[pigeonCounts[name]]] }
    });
  } catch(err){ console.error(err); }
}

// --- RENDER ---
function renderPlans() {
  planListTbody.innerHTML='';
  plans.forEach((p,i)=>{
    const tr=document.createElement('tr');

    const tdDate=document.createElement('td'); tdDate.textContent=p.date;
    const tdRest=document.createElement('td'); tdRest.textContent=p.restaurant;
    const tdMem=document.createElement('td'); tdMem.innerHTML=p.participants.map(n=>`<span>${n}</span>`).join('');
    const tdDone=document.createElement('td');
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=p.done; chk.addEventListener('change',()=>toggleDone(i));
    tdDone.appendChild(chk);
    const tdNote=document.createElement('td'); 
    const noteInput=document.createElement('input'); noteInput.type='text'; noteInput.value=p.note; noteInput.addEventListener('change',()=>updateNote(i,noteInput.value));
    tdNote.appendChild(noteInput);
    const tdOp=document.createElement('td'); 
    const delBtn=document.createElement('button'); delBtn.innerHTML='<i class="fas fa-trash-alt"></i> Delete'; delBtn.addEventListener('click',()=>deletePlan(i));
    tdOp.appendChild(delBtn);

    tr.append(tdDate,tdRest,tdMem,tdDone,tdNote,tdOp);
    planListTbody.appendChild(tr);
  });
}

function renderRank() {
  pigeonTbody.innerHTML='';
  Object.entries(pigeonCounts).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); tdName.textContent=name;
    const tdCount=document.createElement('td'); tdCount.textContent=count;
    const tdBtn=document.createElement('td'); const btn=document.createElement('button'); btn.textContent='放鸽子 +1'; btn.addEventListener('click',()=>incrementPigeon(name));
    tdBtn.appendChild(btn);
    tr.append(tdName,tdCount,tdBtn);
    pigeonTbody.appendChild(tr);
  });
}
