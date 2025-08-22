// --- CONFIGURATION ---
const API_KEY = 'AIzaSyBniXl_kpJlEqQXs4htzl_lEkLO5su5OqY'; 
const CLIENT_ID = '53198014929-ukavfd14a6p17a43c8n9en6qdb4tdpha.apps.googleusercontent.com';
const SHEET_ID = '1TPt4IN3zAstf1v04gKnNA_YueyTwEpsHtmWfgvFU9Gk';
const SHEET_NAME = 'Plans'; 
const PIGEON_SHEET = 'PigeonRank';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// --- GLOBAL VARIABLES ---
let plans = [];
let pigeonCounts = { '😈': 0, '🐧': 0, '🧊': 0, '💭': 0 };
const members = ['😈', '🐧', '🧊', '💭'];
const memberAvatars = {
  '😈': 'https://i.imgur.com/1.png',
  '🐧': 'https://i.imgur.com/2.png',
  '🧊': 'https://i.imgur.com/3.png',
  '💭': 'https://i.imgur.com/4.png'
};

// --- DOM ELEMENTS ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const planForm = document.getElementById('plan-form');

// --- INITIALIZATION & AUTHENTICATION ---
function handleCredentialResponse(response) {
  const accessToken = response.credential;
  // Use the access token to authenticate gapi.client
  gapi.client.setToken({ access_token: accessToken });
  console.log("✅ Logged in successfully with GIS");
  updateSigninStatus(true);
}

function handleGapiLoad() {
  gapi.load('client', () => {
    gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    // Load data only after a successful sign-in
    loadPlans();
    loadPigeonCounts();
  } else {
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    document.getElementById('plan-list').innerHTML = '';
    document.getElementById('pigeon-rank').innerHTML = '';
  }
}

window.onload = function () {
  // Initialize Google Identity Services (GIS)
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    scope: SCOPES,
  });

  // Render the Google Sign-In button
  google.accounts.id.renderButton(
    loginBtn,
    { theme: "outline", size: "large" }
  );

  // Set up sign-out button functionality
  logoutBtn.onclick = () => {
    google.accounts.id.disableAutoSelect();
    gapi.client.setToken(null);
    updateSigninStatus(false);
    console.log("✅ Signed out");
  };

  // Load the GAPI client library
  handleGapiLoad();

  // Attach form submit listener
  planForm.addEventListener('submit', handleFormSubmit);
};

// --- DATA HANDLERS ---
async function handleFormSubmit(e) {
  e.preventDefault();

  const newPlanData = {
    date: document.getElementById('date').value,
    restaurant: document.getElementById('restaurant').value,
    note: document.getElementById('note').value,
    participants: Array.from(document.querySelectorAll('input[name="members"]:checked')).map(el => el.value),
    initiator: (Array.from(document.querySelectorAll('input[name="members"]:checked')).map(el => el.value))[0] || '',
    done: false
  };

  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          newPlanData.date,
          newPlanData.restaurant,
          newPlanData.initiator,
          newPlanData.participants.join(','),
          newPlanData.done ? '是' : '否',
          newPlanData.note
        ]]
      }
    });
    alert('✅ Plan added successfully!');
    this.reset();
    await loadPlans();
  } catch (err) {
    console.error("❌ Failed to add plan:", err);
    alert("Failed to add plan. Please check the console for details.");
  }
}

async function loadPlans() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:F`
    });
    const rows = res.result.values || [];
    plans = rows.map((row, index) => ({
      rowIndex: index + 2,
      date: row[0] || '',
      restaurant: row[1] || '',
      initiator: row[2] || '',
      participants: row[3] ? row[3].split(',') : [],
      done: row[4] === '是',
      note: row[5] || ''
    }));
    renderPlans();
  } catch (err) {
    console.error("❌ Failed to load plans:", err);
  }
}

async function loadPigeonCounts() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PIGEON_SHEET}!A2:B`
    });
    const rows = res.result.values || [];
    pigeonCounts = {};
    rows.forEach(row => {
      const name = row[0];
      const count = parseInt(row[1] || "0", 10);
      pigeonCounts[name] = count;
    });
    renderRank();
  } catch (err) {
    console.error("❌ Failed to load pigeon counts:", err);
    alert("加载放鸽子次数失败，请检查控制台");
  }
}

async function incrementPigeon(name) {
  pigeonCounts[name] += 1;
  renderRank();
  try {
    const membersList = Object.keys(pigeonCounts);
    const rowIndex = membersList.indexOf(name) + 2;
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${PIGEON_SHEET}!B${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[pigeonCounts[name]]] }
    });
    console.log(`✅ Updated ${name} to ${pigeonCounts[name]}`);
  } catch (err) {
    console.error("❌ Failed to update pigeon count:", err);
    alert("更新放鸽子次数失败，请重试");
  }
}

async function toggleDone(index) {
  plans[index].done = !plans[index].done;
  await updatePlanRow(index);
}

async function updateNote(index, value) {
  plans[index].note = value;
  await updatePlanRow(index);
}

async function updatePlanRow(index) {
  const plan = plans[index];
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${plan.rowIndex}:F${plan.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          plan.date,
          plan.restaurant,
          plan.initiator,
          plan.participants.join(','),
          plan.done ? '是' : '否',
          plan.note
        ]]
      }
    });
  } catch (err) {
    console.error("❌ Failed to update row:", err);
  }
}

async function deletePlan(index) {
  if (!confirm("Are you sure you want to delete this plan?")) return;
  const plan = plans[index];
  try {
    const res = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheet = res.result.sheets.find(s => s.properties.title === SHEET_NAME);
    const sheetId = sheet.properties.sheetId;
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: plan.rowIndex - 1,
              endIndex: plan.rowIndex
            }
          }
        }]
      }
    });
    await loadPlans();
  } catch (err) {
    console.error("❌ Failed to delete plan:", err);
  }
}

// --- RENDER FUNCTIONS ---
function renderPlans() {
  const tbody = document.getElementById('plan-list');
  tbody.innerHTML = '';
  plans.forEach((plan, index) => {
    const row = document.createElement('tr');
    row.classList.add('fade-in');
    row.innerHTML = `
      <td>${plan.date}</td>
      <td>${plan.restaurant}</td>
      <td>${renderMemberTags(plan.participants)}</td>
      <td><input type="checkbox" ${plan.done ? 'checked' : ''} onchange="toggleDone(${index})"></td>
      <td><input type="text" value="${plan.note}" onchange="updateNote(${index}, this.value)"></td>
      <td><button onclick="deletePlan(${index})"><i class="fas fa-trash-alt"></i> Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

function renderRank() {
  const sorted = Object.entries(pigeonCounts).sort((a, b) => b[1] - a[1]);
  const tbody = document.getElementById('pigeon-rank');
  tbody.innerHTML = '';
  sorted.forEach(([name, count]) => {
    const row = document.createElement('tr');
    row.classList.add('fade-in');
    row.innerHTML = `
      <td>${renderMemberTags([name])}</td>
      <td>${count}</td>
      <td><button class="pigeon-btn" onclick="incrementPigeon('${name}')">放鸽子 +1</button></td>
    `;
    tbody.appendChild(row);
  });
}

// --- HELPERS ---
function renderMemberTags(names) {
  return names.map(name => `
    <span class="member-tag">
      <img src="${memberAvatars[name]}" alt="${name}">${name}
    </span>
  `).join('');
}
