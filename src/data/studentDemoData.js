// =====================================================
// Static demo data for fields that are NOT yet driven by APIs.
//
// LIVE (from adapters in src/services/*):
//   - per-app: id, name, dailyGoal, todayXP, weeklyXP, status, link, nextLesson
//
// STILL STATIC (here):
//   - studentName
//   - weeklyHistory (TODO: derive from app history endpoints)
//   - leaderboard   (TODO: derive from a class/cohort service)
//
// Edit this file to change the student name, weekly bar chart, or leaderboard.
// =====================================================

export const studentDemoData = {
  studentName: "Samuel",

  // Last 7 days, oldest -> newest. Today is the last entry.
  weeklyHistory: [
    { day: "Mon", xp: 110 },
    { day: "Tue", xp: 95 },
    { day: "Wed", xp: 130 },
    { day: "Thu", xp: 60 },
    { day: "Fri", xp: 120 },
    { day: "Sat", xp: 80 },
    { day: "Sun", xp: 54 } // today
  ],

  leaderboard: {
    weeklyLeaders: [
      { name: "Ava", weeklyXP: 920 },
      { name: "Liam", weeklyXP: 870 },
      { name: "Mia", weeklyXP: 810 }
    ],
    mostImproved: [
      { name: "Noah", improvement: 64 },
      { name: "Zoe", improvement: 41 },
      { name: "Samuel", improvement: 28 }
    ],
    streakLeaders: [
      { name: "Liam", streak: 28 },
      { name: "Ava", streak: 22 },
      { name: "Samuel", streak: 14 }
    ],
    personalBest: {
      name: "Samuel",
      label: "Best week yet",
      weeklyXP: 920
    }
  }
};
