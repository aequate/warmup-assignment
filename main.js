const fs = require("fs");

// =====================================================
// --------------------   Helpers   --------------------
// =====================================================

function parse12HourTime(timeStr) {
  if (typeof timeStr !== "string") return 0;

  const cleaned = timeStr.trim().toLowerCase().replace(/\./g, "");
  const parts = cleaned.split(/\s+/);
  if (parts.length !== 2) return 0;

  const timePart = parts[0];
  const period = parts[1];
  const t = timePart.split(":");
  if (t.length !== 3) return 0;

  let hour = parseInt(t[0], 10);
  const minute = parseInt(t[1], 10);
  const second = parseInt(t[2], 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return 0;
  }

  if (period === "am") {
    if (hour === 12) hour = 0;
  } else if (period === "pm") {
    if (hour !== 12) hour += 12;
  } else {
    return 0;
  }

  return hour * 3600 + minute * 60 + second;
}

function timeToSeconds(timeStr) {
  if (typeof timeStr !== "string") return 0;

  const t = timeStr.trim().split(":");
  if (t.length !== 3) return 0;

  const hour = parseInt(t[0], 10);
  const minute = parseInt(t[1], 10);
  const second = parseInt(t[2], 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return 0;
  }

  return hour * 3600 + minute * 60 + second;
}

function secondsToTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    hours +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}

function normalizeMonth(month) {
  const parsed = parseInt(month, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) return "";
  return String(parsed);
}

function getMonthFromDate(dateStr) {
  if (typeof dateStr !== "string") return "";
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return "";
  return normalizeMonth(parts[1]);
}

function isEidDate(dateStr) {
  if (typeof dateStr !== "string") return false;

  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  return year === 2025 && month === 4 && day >= 10 && day <= 30;
}

function readAllNonEmptyLines(textFile) {
  try {
    const fileData = fs.readFileSync(textFile, { encoding: "utf8", flag: "r" });
    return fileData.split(/\r?\n/).filter((line) => line.trim() !== "");
  } catch (e) {
    return [];
  }
}

function readLines(textFile) {
  const lines = readAllNonEmptyLines(textFile);
  if (lines.length === 0) return [];
  return lines.slice(1);
}

function parseShiftLine(line) {
  const cols = String(line).split(",");
  return {
    driverID: (cols[0] || "").trim(),
    driverName: (cols[1] || "").trim(),
    date: (cols[2] || "").trim(),
    startTime: (cols[3] || "").trim(),
    endTime: (cols[4] || "").trim(),
    shiftDuration: (cols[5] || "").trim(),
    idleTime: (cols[6] || "").trim(),
    activeTime: (cols[7] || "").trim(),
    metQuota: String(cols[8]).trim().toLowerCase() === "true",
    hasBonus: String(cols[9]).trim().toLowerCase() === "true",
  };
}

function shiftObjToLine(record) {
  return [
    record.driverID,
    record.driverName,
    record.date,
    record.startTime,
    record.endTime,
    record.shiftDuration,
    record.idleTime,
    record.activeTime,
    String(record.metQuota),
    String(record.hasBonus),
  ].join(",");
}

function readHeader(textFile) {
  const lines = readAllNonEmptyLines(textFile);
  if (lines.length === 0) {
    return "DriverID,DriverName,Date,StartTime,EndTime,ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus";
  }
  return lines[0];
}

function writeShiftRecords(textFile, records) {
  const header = readHeader(textFile);
  const body = records.map(shiftObjToLine);
  const output = [header].concat(body).join("\n");
  fs.writeFileSync(textFile, output, { encoding: "utf8" });
}

function getDayName(dateStr) {
  if (typeof dateStr !== "string") return "";

  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return "";

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return "";
  }

  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return names[new Date(year, month - 1, day).getDay()];
}

function getDriverRate(rateFile, driverID) {
  try {
    const lines = fs
      .readFileSync(rateFile, { encoding: "utf8", flag: "r" })
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if ((cols[0] || "").trim() === driverID) {
        return {
          driverID: (cols[0] || "").trim(),
          dayOff: (cols[1] || "").trim(),
          basePay: parseInt((cols[2] || "").trim(), 10) || 0,
          tier: parseInt((cols[3] || "").trim(), 10) || 0,
        };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

function getShiftLengthSeconds(startTime, endTime) {
  const startSeconds = parse12HourTime(startTime);
  const endSeconds = parse12HourTime(endTime);

  if (endSeconds >= startSeconds) {
    return endSeconds - startSeconds;
  }

  return 24 * 3600 - startSeconds + endSeconds;
}

function getIdleInRange(startSeconds, endSeconds) {
  const workStart = 8 * 3600;
  const workEnd = 22 * 3600;

  let idle = 0;

  idle += Math.max(0, Math.min(endSeconds, workStart) - startSeconds);
  idle += Math.max(0, endSeconds - Math.max(startSeconds, workEnd));

  return idle;
}

function compareDriverIDs(idA, idB) {
  const numA = parseInt(String(idA).replace(/\D/g, ""), 10);
  const numB = parseInt(String(idB).replace(/\D/g, ""), 10);

  if (Number.isNaN(numA) && Number.isNaN(numB)) {
    return String(idA).localeCompare(String(idB));
  }
  if (Number.isNaN(numA)) return 1;
  if (Number.isNaN(numB)) return -1;

  return numA - numB;
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
  return secondsToTime(getShiftLengthSeconds(startTime, endTime));
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
  const startSeconds = parse12HourTime(startTime);
  const endSeconds = parse12HourTime(endTime);

  let idle = 0;

  if (endSeconds >= startSeconds) {
    idle = getIdleInRange(startSeconds, endSeconds);
  } else {
    idle =
      getIdleInRange(startSeconds, 24 * 3600) + getIdleInRange(0, endSeconds);
  }

  return secondsToTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  const shiftSeconds = timeToSeconds(shiftDuration);
  const idleSeconds = timeToSeconds(idleTime);

  return secondsToTime(shiftSeconds - idleSeconds);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
  const activeSeconds = timeToSeconds(activeTime);
  const requiredSeconds = isEidDate(date) ? 6 * 3600 : 8 * 3600 + 24 * 60;

  return activeSeconds >= requiredSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  if (!shiftObj || typeof shiftObj !== "object") return {};

  const requiredKeys = [
    "driverID",
    "driverName",
    "date",
    "startTime",
    "endTime",
  ];
  for (let i = 0; i < requiredKeys.length; i++) {
    const key = requiredKeys[i];
    if (typeof shiftObj[key] !== "string") return {};
  }

  const records = readLines(textFile).map(parseShiftLine);

  const newRecord = {
    driverID: shiftObj.driverID.trim(),
    driverName: shiftObj.driverName.trim(),
    date: shiftObj.date.trim(),
    startTime: shiftObj.startTime.trim(),
    endTime: shiftObj.endTime.trim(),
    shiftDuration: "",
    idleTime: "",
    activeTime: "",
    metQuota: false,
    hasBonus: false,
  };

  if (
    newRecord.driverID === "" ||
    newRecord.driverName === "" ||
    newRecord.date === "" ||
    newRecord.startTime === "" ||
    newRecord.endTime === ""
  ) {
    return {};
  }

  for (let i = 0; i < records.length; i++) {
    if (
      records[i].driverID === newRecord.driverID &&
      records[i].date === newRecord.date
    ) {
      return {};
    }
  }

  newRecord.shiftDuration = getShiftDuration(
    newRecord.startTime,
    newRecord.endTime,
  );
  newRecord.idleTime = getIdleTime(newRecord.startTime, newRecord.endTime);
  newRecord.activeTime = getActiveTime(
    newRecord.shiftDuration,
    newRecord.idleTime,
  );
  newRecord.metQuota = metQuota(newRecord.date, newRecord.activeTime);

  let insertIndex = records.length;
  let foundDriver = false;

  for (let i = 0; i < records.length; i++) {
    if (records[i].driverID === newRecord.driverID) {
      foundDriver = true;
      insertIndex = i + 1;
    }
  }

  if (foundDriver) {
    records.splice(insertIndex, 0, newRecord);
  } else {
    records.push(newRecord);
  }

  writeShiftRecords(textFile, records);

  return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
  if (typeof newValue !== "boolean") return;

  const records = readLines(textFile).map(parseShiftLine);
  let found = false;

  for (let i = 0; i < records.length; i++) {
    if (records[i].driverID === driverID && records[i].date === date) {
      records[i].hasBonus = newValue;
      found = true;
      break;
    }
  }

  if (!found) return;

  writeShiftRecords(textFile, records);
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
  const records = readLines(textFile).map(parseShiftLine);
  const targetMonth = normalizeMonth(month);

  let driverExists = false;
  let count = 0;

  for (let i = 0; i < records.length; i++) {
    if (records[i].driverID === driverID) {
      driverExists = true;

      if (
        getMonthFromDate(records[i].date) === targetMonth &&
        records[i].hasBonus
      ) {
        count++;
      }
    }
  }

  return driverExists ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const records = readLines(textFile).map(parseShiftLine);
  const targetMonth = normalizeMonth(month);

  let totalSeconds = 0;

  for (let i = 0; i < records.length; i++) {
    if (
      records[i].driverID === driverID &&
      getMonthFromDate(records[i].date) === targetMonth
    ) {
      totalSeconds += timeToSeconds(records[i].activeTime);
    }
  }

  return secondsToTime(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(
  textFile,
  rateFile,
  bonusCount,
  driverID,
  month,
) {
  const records = readLines(textFile).map(parseShiftLine);
  const rate = getDriverRate(rateFile, driverID);
  const targetMonth = normalizeMonth(month);

  if (!rate || targetMonth === "") return "0:00:00";

  let totalSeconds = 0;
  let safeBonusCount = parseInt(bonusCount, 10);
  if (Number.isNaN(safeBonusCount) || safeBonusCount < 0) safeBonusCount = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    if (rec.driverID !== driverID) continue;
    if (getMonthFromDate(rec.date) !== targetMonth) continue;

    const dayName = getDayName(rec.date);
    if (dayName === rate.dayOff) continue;

    totalSeconds += isEidDate(rec.date) ? 6 * 3600 : 8 * 3600 + 24 * 60;
  }

  totalSeconds -= safeBonusCount * 2 * 3600;
  totalSeconds = Math.max(0, totalSeconds);

  return secondsToTime(totalSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const rate = getDriverRate(rateFile, driverID);
  if (!rate) return 0;

  const actualSeconds = timeToSeconds(actualHours);
  const requiredSeconds = timeToSeconds(requiredHours);

  if (actualSeconds >= requiredSeconds) return rate.basePay;

  const allowanceByTier = {
    1: 50,
    2: 20,
    3: 10,
    4: 3,
  };

  const missingSeconds = requiredSeconds - actualSeconds;
  const allowedMissingHours = allowanceByTier[rate.tier] || 0;
  const missingAfterAllowance = Math.max(
    0,
    missingSeconds - allowedMissingHours * 3600,
  );
  const deductedHours = Math.floor(missingAfterAllowance / 3600);

  const deductionRatePerHour = Math.floor(rate.basePay / 185);
  const salaryDeduction = deductedHours * deductionRatePerHour;

  return Math.max(0, rate.basePay - salaryDeduction);
}

module.exports = {
  getShiftDuration,
  getIdleTime,
  getActiveTime,
  metQuota,
  addShiftRecord,
  setBonus,
  countBonusPerMonth,
  getTotalActiveHoursPerMonth,
  getRequiredHoursPerMonth,
  getNetPay,
};
