const API_KEY = 'AIzaSyBniXl_kpJlEqQXs4htzl_lEkLO5su5OqY';
const SHEET_ID = '1TPt4IN3zAstf1v04gKnNA_YueyTwEpsHtmWfgvFU9Gk';

let plans = [];
const members = ['A', 'B', 'C', 'D'];
const memberAvatars = {
  A: 'https://i.imgur.com/1.png',
  B: 'https://i.imgur.com/2.png',
  C: 'https://i.imgur.com/3.png',
  D: 'https://i.imgur.com/4.png'
};

gapi.load('client', async () => {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"]
  });
  await loadPlans();
  await loadRank();
});

// -------------------- Plans --------------------
async function loadPlans() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Plans!A2:F1000` // 指向 Plans sheet
    });

    const rows = res.result.values || [];
    plans = rows.map(row => ({
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
    console.error("❌ 加载计划失败:", err.result?.error || err);
    alert("加载计划失败，请检查控制台错误信息");
  }
}

document.getElementById('plan-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const date = document.getElementById('date').value;
  const restaurant = document.getElementById('restaurant').value;
  const note = document.getElementById('note').value;
  const selectedMembers = Array.from(document.querySelectorAll('input[name="members"]:checked')).map(el => el.value);

  const newPlan = {
    date,
    restaurant,
    initiator: selectedMembers[0] || '',
    participants: selectedMembers,
    done: false,
    note
  };

  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `Plans!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          newPlan.date,
          newPlan.restaurant,
          newPlan.initiator,
          newPlan.participants.join(','),
          newPlan.done ? '是' : '否',
          newPlan.note
        ]]
      }
    });

    alert('✅ 提交成功！');
    this.reset();
    await loadPlans();
  } catch (err) {
    console.error("❌ 提交失败:", err.result?.error || err);
    alert("提交失败，请检查控制台错误信息");
  }
});

// -------------------- Pigeon Rank --------------------
async function loadRank() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `PigeonRank!A2:B1000`
    });

    const rows = res.result.values || [];
    renderRank();
  } catch (err) {
    console.error("❌ 加载排名失败:", err.result?.error || err);
  }
}

// -------------------- 渲染函数 --------------------
function renderMemberTags(names) {
  return names.map(name => `
    <span class="member-tag">
      <img src="${memberAvatars[name]}" alt="${name}">${name}
    </span>
  `).join('');
}

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
      <td><button onclick="deletePlan(${index})"><i class="fas fa-trash-alt"></i> 删除</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function toggleDone(index) {
  plans[index].done = !plans[index].done;
  await updatePlanRow(index);
  renderRank();
}

function updateNote(index, value) {
  plans[index].note = value;
  updatePlanRow(index); // 同步到 sheet
}

async function deletePlan(index) {
  try {
    // 删除对应行（Google Sheets API 没有直接删除单元格，只能使用 batchUpdate）
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: await getSheetId('Plans'),
              dimension: 'ROWS',
              startIndex: index + 1, // +1 因为 A2 对应 index 0
              endIndex: index + 2
            }
          }
        }]
      }
    });

    plans.splice(index, 1);
    renderPlans();
    renderRank();
  } catch (err) {
    console.error("❌ 删除失败:", err.result?.error || err);
  }
}

// -------------------- 更新单行 --------------------
async function updatePlanRow(index) {
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Plans!A${index + 2}:F${index + 2}`, // A2 对应 index 0
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          plans[index].date,
          plans[index].restaurant,
          plans[index].initiator,
          plans[index].participants.join(','),
          plans[index].done ? '是' : '否',
          plans[index].note
        ]]
      }
    });
  } catch (err) {
    console.error("❌ 更新行失败:", err.result?.error || err);
  }
}

// -------------------- 获取 sheetId --------------------
async function getSheetId(sheetName) {
  const res = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID
  });
  const sheet = res.result.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// -------------------- 渲染排名 --------------------
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
