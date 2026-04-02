import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON: ${path.relative(root, filePath)} (${error.message})`);
    return null;
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateQuestion(question, context) {
  if (!isObject(question)) {
    fail(`${context}: question must be an object`);
    return;
  }

  for (const key of ['id', 'type', 'prompt', 'explanation']) {
    if (typeof question[key] !== 'string' || question[key].trim() === '') {
      fail(`${context}: missing string field "${key}"`);
    }
  }

  if (![1, 2, 3].includes(question.difficulty)) {
    fail(`${context}: difficulty must be 1, 2, or 3`);
  }

  if (question.type === 'multiple-choice') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`${context}: multiple-choice questions need at least 2 options`);
    }
    if (typeof question.correctOptionId !== 'string' || question.correctOptionId.length === 0) {
      fail(`${context}: multiple-choice questions need correctOptionId`);
    }
  }

  if (typeof question.imageUrl === 'string' && question.imageUrl && !/^https?:\/\//.test(question.imageUrl)) {
    const assetPath = path.resolve(context.courseDir, question.imageUrl);
    if (!assetPath.startsWith(context.courseDir)) {
      fail(`${context.label}: asset path escapes course directory (${question.imageUrl})`);
    } else if (!fs.existsSync(assetPath)) {
      fail(`${context.label}: missing asset (${question.imageUrl})`);
    }
  }
}

function validateCoursePackage(folder, packageJson) {
  const courseDir = path.join(root, 'courses', folder);

  if (!isObject(packageJson)) {
    fail(`courses/${folder}/config.json: package must be an object`);
    return null;
  }

  if (typeof packageJson.schemaVersion !== 'string' || packageJson.schemaVersion.trim() === '') {
    fail(`courses/${folder}/config.json: schemaVersion is required`);
  }

  const course = packageJson.course;
  if (!isObject(course)) {
    fail(`courses/${folder}/config.json: course must be an object`);
    return null;
  }

  for (const key of ['id', 'title', 'icon', 'description', 'version']) {
    if (typeof course[key] !== 'string' || course[key].trim() === '') {
      fail(`courses/${folder}/config.json: course.${key} is required`);
    }
  }

  if (!Array.isArray(packageJson.patterns) || packageJson.patterns.length === 0) {
    fail(`courses/${folder}/config.json: patterns must be a non-empty array`);
    return course.id ?? null;
  }

  const patternIds = new Set();
  const lessonIds = new Set();

  packageJson.patterns.forEach((pattern, patternIndex) => {
    const patternLabel = `courses/${folder}/config.json patterns[${patternIndex}]`;
    if (!isObject(pattern)) {
      fail(`${patternLabel}: pattern must be an object`);
      return;
    }

    for (const key of ['id', 'title', 'category', 'icon', 'description', 'difficulty']) {
      if (typeof pattern[key] !== 'string' || pattern[key].trim() === '') {
        fail(`${patternLabel}: ${key} is required`);
      }
    }

    if (pattern.category !== course.id) {
      fail(`${patternLabel}: category must equal course.id (${course.id})`);
    }

    if (patternIds.has(pattern.id)) {
      fail(`${patternLabel}: duplicate pattern id "${pattern.id}"`);
    }
    patternIds.add(pattern.id);

    if (!Array.isArray(pattern.lessons) || pattern.lessons.length === 0) {
      fail(`${patternLabel}: lessons must be a non-empty array`);
      return;
    }

    pattern.lessons.forEach((lesson, lessonIndex) => {
      const lessonLabel = `${patternLabel} lessons[${lessonIndex}]`;
      if (!isObject(lesson)) {
        fail(`${lessonLabel}: lesson must be an object`);
        return;
      }

      for (const key of ['id', 'patternId', 'title', 'intro']) {
        if (typeof lesson[key] !== 'string' || lesson[key].trim() === '') {
          fail(`${lessonLabel}: ${key} is required`);
        }
      }

      if (lesson.patternId !== pattern.id) {
        fail(`${lessonLabel}: patternId must equal parent pattern id (${pattern.id})`);
      }

      if (typeof lesson.order !== 'number') {
        fail(`${lessonLabel}: order must be a number`);
      }

      if (lessonIds.has(lesson.id)) {
        fail(`${lessonLabel}: duplicate lesson id "${lesson.id}"`);
      }
      lessonIds.add(lesson.id);

      if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
        fail(`${lessonLabel}: questions must be a non-empty array`);
        return;
      }

      lesson.questions.forEach((question, questionIndex) => {
        validateQuestion(question, {
          label: `${lessonLabel} questions[${questionIndex}]`,
          courseDir,
        });
      });
    });
  });

  return course.id;
}

for (const requiredPath of ['README.md', 'courses.json', 'courses']) {
  if (!fs.existsSync(path.join(root, requiredPath))) {
    fail(`Missing required path: ${requiredPath}`);
  }
}

const indexPath = path.join(root, 'courses.json');
const courseIndex = readJson(indexPath);
const courseIds = new Set();
const folders = new Set();

if (!Array.isArray(courseIndex)) {
  fail('courses.json must contain an array');
} else {
  for (const [index, entry] of courseIndex.entries()) {
    const label = `courses.json[${index}]`;
    if (!isObject(entry)) {
      fail(`${label}: entry must be an object`);
      continue;
    }

    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      fail(`${label}: name is required`);
    }
    if (typeof entry.folder !== 'string' || entry.folder.trim() === '') {
      fail(`${label}: folder is required`);
      continue;
    }

    if (folders.has(entry.folder)) {
      fail(`${label}: duplicate folder "${entry.folder}"`);
      continue;
    }
    folders.add(entry.folder);

    const configPath = path.join(root, 'courses', entry.folder, 'config.json');
    if (!fs.existsSync(configPath)) {
      fail(`${label}: missing ${path.relative(root, configPath)}`);
      continue;
    }

    const packageJson = readJson(configPath);
    const courseId = validateCoursePackage(entry.folder, packageJson);

    if (typeof entry.courseId === 'string' && courseId && entry.courseId !== courseId) {
      fail(`${label}: courseId must match config.json course.id (${courseId})`);
    }

    if (courseId) {
      if (courseIds.has(courseId)) {
        fail(`${label}: duplicate course id "${courseId}"`);
      }
      courseIds.add(courseId);
    }
  }
}

const courseRoot = path.join(root, 'courses');
if (fs.existsSync(courseRoot)) {
  for (const entry of fs.readdirSync(courseRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!folders.has(entry.name)) {
      fail(`courses/${entry.name} exists but is missing from courses.json`);
    }
  }
}

if (errors.length > 0) {
  console.error('Open course repository validation failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Open course repository validation passed.');
