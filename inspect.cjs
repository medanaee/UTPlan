const { DatabaseSync } = require('node:sqlite');
const Database = DatabaseSync;
const path = require('path');
const fs = require('fs');

let dbPath = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/73bc7bef72332bdf65370576a5eb4b864baeeb87ff4ada39ab99e31e395c1a1a.sqlite';

console.log('Using dbPath:', dbPath);
const db = new Database(dbPath);

const offs = db.prepare("SELECT * FROM course_offerings WHERE id IN ('off_e097e5ca', 'off_2f30fb98')").all();
console.log('Offerings:', JSON.stringify(offs, null, 2));

const courses = db.prepare("SELECT id, name, code FROM courses WHERE id IN (SELECT course_id FROM course_offerings WHERE id IN ('off_e097e5ca', 'off_2f30fb98'))").all();
console.log('Courses:', JSON.stringify(courses, null, 2));


const allCustom = db.prepare("SELECT * FROM course_events WHERE is_user_custom = 1").all();
console.log('All custom events count:', allCustom.length);
console.log('Custom events:', JSON.stringify(allCustom, null, 2));

const offerings = db.prepare("SELECT * FROM course_offerings WHERE id IN (SELECT offering_id FROM course_events WHERE is_user_custom = 1)").all();
console.log('Offerings for custom:', JSON.stringify(offerings, null, 2));
