// --- CONFIGURATION ---
const CLIENT_ID = '53198014929-ukavfd14a6p17a43c8n9en6qdb4tdpha.apps.googleusercontent.com';
const SHEET_ID = '1TPt4IN3zAstf1v04gKnNA_YueyTwEpsHtmWfgvFU9Gk';
const SHEET_NAME = 'Meal'; // Using 'Meal' from your original script
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// --- GLOBAL VARIABLES ---
let tokenClient;
let plans = [];
const members = ['A', 'B', 'C', 'D'];
const memberAvatars = {
  A: 'https://i.imgur.com/1.png',
  B: 'https://i.imgur.com/2.png',
  C: 'https://i.imgur.com/3.png',
  D: 'https://i.imgur.com/4.png'
};

// --- DOM ELEMENTS ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoDiv = document.getElementById('user-info');
const mainContent = document.getElementById('main-content');

// --- INITIALIZATION ---
window.onload = () => {
  // Load Google's API client
  gapi.load('client', initializeGapiClient);
  // Load Google's Identity Services client
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: () => {} // Callback is handled by the token client
  });
};

async function initializeGapiClient() {
  await gapi.client.init({
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  // The client is ready, now initialize the token client
  initializeTokenClient();
}

function initializeTokenClient() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Authentication error:", tokenResponse.error);
        alert("Login failed. Please check the console for details.");
        return;
      }
      console.log("✅ Login successful!");
      updateUi(true);
      await loadPlans();
    },
  });
}

// --- UI AND EVENT HANDLERS ---
loginBtn.onclick = () => tokenClient.requestAccessToken();

logoutBtn.onclick = () => {
  gapi.client.setToken(null);
  updateUi(false);
  // Clear the UI
  document.getElementById('plan-list').innerHTML = '';
  document.getElementById('pigeon-rank').innerHTML = '';
};

function updateUi(isLoggedIn) {
  loginBtn.style.display = isLoggedIn ? 'none' : 'block';
  userInfoDiv.style.display = isLoggedIn ? 'block' : 'none';
  mainContent.style.display = isLoggedIn ? 'block' : 'none';
}

document.getElementById('plan-form').addEventListener('submit', async function(e) {
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
        values: [
          [
            newPlanData.date,
            newPlanData.restaurant,
            newPlanData.initiator,
            newPlanData.participants.join(','),
            newPlanData.done ? '是' : '否',
            newPlanData.note
          ]
        ]
      }
    });
    alert('✅ Plan added successfully!');
    this.reset();
    await loadPlans(); // Reload data to show the new plan
  } catch (err) {
    console.error("❌ Failed to add plan:", err);
    alert("Failed to add plan. Please check the console for details.");
  }
});


// --- DATA & API FUNCTIONS ---
async function loadPlans() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:F` // Assuming headers are in row 1
    });
    const rows = res.result.values || [];
    plans = rows.map((row, index) => ({
      rowIndex: index + 2, // Spreadsheet rows are 1-based, and we start from A2
      date: row[0] || '',
      restaurant: row[1] || '',
      initiator: row[2] || '',
      participants: row[3] ? row[3].split(',') : [],
      done: row[4] === '是',
      note: row[5] || ''
    }));
    renderPlans();
    renderRank();
  } catch (err) {
    console.error("❌ Failed to load plans:", err);
    alert("Failed to load plans. Please check the console for details.");
  }
}

async function updatePlanRow(index) {
  const plan = plans[index];
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${plan.rowIndex}:F${plan.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            plan.date,
            plan.restaurant,
            plan.initiator,
            plan.participants.join(','),
            plan.done ? '是' : '否',
            plan.note
          ]
        ]
      }
    });
    console.log(`✅ Row ${plan.rowIndex} updated successfully.`);
  } catch (err) {
    console.error("❌ Failed to update row:", err);
    alert("Failed to sync changes. Please try again.");
  }
}

async function deletePlan(index) {
  if (!confirm("Are you sure you want to delete this plan?")) return;

  const plan = plans[index];
  try {
    // To delete a row, we need the sheet's numerical ID, not its name
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
              startIndex: plan.rowIndex - 1, // API index is 0-based
              endIndex: plan.rowIndex
            }
          }
        }]
      }
    });
    alert('✅ Plan deleted successfully!');
    // After deleting from the sheet, reload all data to ensure consistency
    await loadPlans();
  } catch (err) {
    console.error("❌ Failed to delete plan:", err);
    alert("Failed to delete plan. Please check the console for details.");
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
  const rank = {};
  members.forEach(name => rank[name] = 0);
  plans.forEach(plan => {
    if (!plan.done) {
      plan.participants.forEach(name => {
        rank[name]++;
      });
    }
  });
  const sorted = Object.entries(rank).sort((a, b) => b[1] - a[1]);
  const tbody = document.getElementById('pigeon-rank');
  tbody.innerHTML = '';
  sorted.forEach(([name, count]) => {
    const row = document.createElement('tr');
    row.classList.add('fade-in');
    row.innerHTML = `
      <td>${renderMemberTags([name])}</td>
      <td>${count}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderMemberTags(names) {
  return names.map(name => `
    <span class="member-tag">
      <img src="${memberAvatars[name]}" alt="${name}">${name}
    </span>
  `).join('');
}

// --- EVENT-TRIGGERED UPDATE FUNCTIONS ---
async function toggleDone(index) {
  plans[index].done = !plans[index].done;
  renderRank(); // Update rank UI immediately for responsiveness
  await updatePlanRow(index);
}

async function updateNote(index, value) {
  plans[index].note = value;
  await updatePlanRow(index);
}
