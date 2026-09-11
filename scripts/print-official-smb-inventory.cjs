const { loadOfficialInventory } = require("../utils/officialSmbInventory");
console.log(JSON.stringify(loadOfficialInventory(), null, 2));
