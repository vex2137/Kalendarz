export const batchCases=[
 ['pl','Dodaj trzy wydarzenia: „TEST A” 13 listopada 2026 od 10:00 do 11:00, „TEST B” 14 listopada 2026 od 12:00 do 13:00 oraz „TEST C” 15 listopada 2026 od 14:00 do 15:00.',3],
 ['pl','Dodaj dwa wydarzenia: TEST A dnia 2026-11-13 od 10:00 do 11:00 oraz TEST B dnia 2026-11-14 od 12:00 do 13:00.',2],
 ['pl','Dodaj wydarzenie TEST A na 2026-11-13 od 10:00 do 11:00. Dodaj wydarzenie TEST B na 2026-11-14 od 12:00 do 13:00.',2],
 ['en','Add three events: “TEST A” on November 13, 2026 from 10:00 to 11:00, “TEST B” on November 14, 2026 from 12:00 to 13:00 and “TEST C” on November 15, 2026 from 14:00 to 15:00.',3],
 ['en','Add two events: TEST A on 2026-11-13 from 10:00 to 11:00 and TEST B on 2026-11-14 from 12:00 to 13:00.',2],
 ['en','Add event TEST A on 2026-11-13 from 10:00 to 11:00. Add event TEST B on 2026-11-14 from 12:00 to 13:00.',2],
] as const;
export const editCases=[
 ['pl','Edytuj wydarzenie TEST BETA 4 z dnia 2026-11-12. Zmień godzinę rozpoczęcia na 09:15, a zakończenia na 10:30.'],
 ['pl','Przesuń wydarzenie «TEST BETA 4» z 12 listopada 2026 na godzinę 09:15–10:30 tego samego dnia.'],
 ['pl','Przenieś wydarzenie «TEST BETA 4» z 12 listopada 2026 na godzinę 09:15–10:30 tego samego dnia.'],
 ['pl','Zmień godzinę wydarzenia «TEST BETA 4» z 12 listopada 2026 na godzinę 09:15–10:30 tego samego dnia.'],
 ['pl','Przełóż wydarzenie «TEST BETA 4» z 12 listopada 2026 na godzinę 09:15–10:30 tego samego dnia.'],
 ['en','Reschedule event “TEST BETA 4” from November 12, 2026 to 09:15–10:30 on the same day.'],
 ['en','Move event “TEST BETA 4” from November 12, 2026 to 09:15–10:30 on the same day.'],
 ['en','Change time of event “TEST BETA 4” from November 12, 2026 to 09:15–10:30 on the same day.'],
] as const;
