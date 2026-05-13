const TODOIST_TOKEN = "253785a50991d573a0362cd7f5d27210d758610d";

async function checkSections() {
  const projects = ["6Jm9HM4fwq7mcXm5", "6g8vQP7W9x2PCpJ7"];
  for (const pid of projects) {
    const res = await fetch(`https://api.todoist.com/api/v1/sections?project_id=${pid}`, {
      headers: { "Authorization": `Bearer ${TODOIST_TOKEN}` }
    });
    const sections = await res.json();
    console.log(`--- SECTIONS FOR PROJECT ${pid} ---`);
    console.log(JSON.stringify(sections, null, 2));
  }
}

checkSections();
