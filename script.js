const API_KEY = 'AIzaSyBniXl_kpJlEqQXs4htzl_lEkLO5su5OqY';
const SHEET_ID = '1TPt4IN3zAstf1v04gKnNA_YueyTwEpsHtmWfgvFU9Gk';
const SHEET_NAME = 'Meal';

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
});

async function loadPlans() {
  try {
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:F1000` // 指定足够大的行数
    });

    // 去掉表头
    const rows = res.result.values ? res.result.values.slice(1) : [];

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
      range: `${SHEET_NAME}!A:F`,
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

function toggleDone(index) {
  plans[index].done = !plans[index].done;
  renderRank();
}

function updateNote(index, value) {
  plans[index].note = value;
}

function deletePlan(index) {
  plans.splice(index, 1);
  renderPlans();
  renderRank();
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



