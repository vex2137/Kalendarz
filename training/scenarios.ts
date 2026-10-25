// Synthetic scenarios only. All paraphrases of a family stay in one split.
export interface Scenario {
  family:string;category:string;pl:string;en:string;
  command:Record<string,string|number|boolean|null>;
}
type Example=[string,string,Record<string,string|number|boolean|null>];
const rows:Record<string,Example[]>={
  absolute:[
    ['Dodaj wydarzenie „{title}” {date} o {time}.','Add event "{title}" on {date} at {time}.',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['Proszę utworzyć „{title}” na {date}, od {time} do {end}.','Please create "{title}" on {date}, from {time} until {end}.',{action:'create',title:'{title}',date:'{date}',time:'{time}',endTime:'{end}'}],
    ['Wpisz „{title}” w dniu {date} o {time}.','Put "{title}" in the calendar for {date} at {time}.',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['{date}, {time}: dodaj „{title}”.','For {date} at {time}, add "{title}".',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['Czy możesz zaplanować „{title}” {date} o {time}?','Could you schedule "{title}" for {date} at {time}?',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['Chciałbym mieć w kalendarzu „{title}”, {date}, godzina {time}.','I would like "{title}" on my calendar on {date} at {time}.',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
  ],
  relative:[
    ['Dodaj „{title}” jutro o {time}.','Add "{title}" tomorrow at {time}.',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}'}],
    ['Zaplanuj „{title}” pojutrze o {time}.','Schedule "{title}" the day after tomorrow at {time}.',{action:'create',title:'{title}',date:'{dayAfter}',time:'{time}'}],
    ['Utwórz „{title}” dzisiaj o {time}.','Create "{title}" today at {time}.',{action:'create',title:'{title}',date:'{today}',time:'{time}'}],
    ['Dodaj „{title}” za 3 dni o {time}.','Add "{title}" in 3 days at {time}.',{action:'create',title:'{title}',date:'{in3}',time:'{time}'}],
    ['Wpisz „{title}” za dwa tygodnie o {time}.','Put "{title}" on the calendar in two weeks at {time}.',{action:'create',title:'{title}',date:'{in14}',time:'{time}'}],
    ['Proszę dodać „{title}” na jutro, cały dzień.','Please add "{title}" for tomorrow, all day.',{action:'create',title:'{title}',date:'{tomorrow}',allDay:true}],
  ],
  times:[
    ['Dodaj „{title}” jutro od 23:30 do 00:30.','Add "{title}" tomorrow from 23:30 until 00:30.',{action:'create',title:'{title}',date:'{tomorrow}',time:'23:30',endTime:'00:30'}],
    ['Dodaj „{title}” {date} w południe.','Add "{title}" on {date} at noon.',{action:'create',title:'{title}',date:'{date}',time:'12:00'}],
    ['Zaplanuj „{title}” {date} o północy.','Schedule "{title}" on {date} at midnight.',{action:'create',title:'{title}',date:'{date}',time:'00:00'}],
    ['Dodaj „{title}” {date} od 15:15 do 16:45.','Add "{title}" on {date} from 3:15 pm to 4:45 pm.',{action:'create',title:'{title}',date:'{date}',time:'15:15',endTime:'16:45'}],
    ['Utwórz „{title}” {date}, godziny 08:05–08:50.','Create "{title}" on {date}, 08:05–08:50.',{action:'create',title:'{title}',date:'{date}',time:'08:05',endTime:'08:50'}],
    ['Dodaj „{title}” {date} na cały dzień, bez godziny.','Add "{title}" on {date} for the whole day, without a time.',{action:'create',title:'{title}',date:'{date}',allDay:true}],
  ],
  update:[
    ['Przenieś wydarzenie „{title}” na jutro o {time}.','Move event "{title}" to tomorrow at {time}.',{action:'update',query:'{title}',date:'{tomorrow}',time:'{time}'}],
    ['Zmień nazwę „{title}” na „{newTitle}”.','Rename "{title}" to "{newTitle}".',{action:'update',query:'{title}',title:'{newTitle}'}],
    ['Zmień godzinę „{title}” na {time}, zachowaj datę.','Change the time of "{title}" to {time}, keep its date.',{action:'update',query:'{title}',time:'{time}'}],
    ['Przesuń „{title}” z {sourceDate} na {date}.','Reschedule "{title}" from {sourceDate} to {date}.',{action:'update',query:'{title}',sourceDate:'{sourceDate}',date:'{date}'}],
    ['Ustaw miejsce „{title}” na „Sala B”.','Set the location of "{title}" to "Sala B".',{action:'update',query:'{title}',location:'Sala B'}],
    ['Dla „{title}” ustaw opis „Lista materiałów”.','For "{title}", set description "Lista materiałów".',{action:'update',query:'{title}',description:'Lista materiałów'}],
  ],
  delete:[
    ['Usuń wydarzenie „{title}”.','Delete event "{title}".',{action:'delete',query:'{title}'}],
    ['Skasuj „{title}” z {sourceDate}.','Remove "{title}" on {sourceDate}.',{action:'delete',query:'{title}',sourceDate:'{sourceDate}'}],
    ['Proszę usunąć wpis „{title}”.','Please delete the entry "{title}".',{action:'delete',query:'{title}'}],
    ['Nie potrzebuję już „{title}”. Przygotuj usunięcie tego wpisu.','I no longer need "{title}". Prepare to remove that entry.',{action:'delete',query:'{title}'}],
    ['Chcę usunąć „{title}”; pokaż je do potwierdzenia.','I want to delete "{title}"; show it for confirmation.',{action:'delete',query:'{title}'}],
    ['Usuń tylko „{title}” z dnia {sourceDate}.','Delete only "{title}" dated {sourceDate}.',{action:'delete',query:'{title}',sourceDate:'{sourceDate}'}],
  ],
  search:[
    ['Znajdź wydarzenie „{title}”.','Find event "{title}".',{action:'search',query:'{title}'}],
    ['Pokaż mi „{title}” na jutro.','Show me "{title}" for tomorrow.',{action:'search',query:'{title}',date:'{tomorrow}'}],
    ['Co mam zaplanowane na {date}?','What is scheduled on {date}?',{action:'search',date:'{date}'}],
    ['Wyszukaj „{title}” od {sourceDate} do {date}.','Search for "{title}" from {sourceDate} through {date}.',{action:'search',query:'{title}',date:'{sourceDate}',endDate:'{date}'}],
    ['Kiedy mam „{title}”?','When is "{title}" on my calendar?',{action:'search',query:'{title}'}],
    ['Pokaż wydarzenia na dzisiaj.','Show events for today.',{action:'search',date:'{today}'}],
  ],
  recurrence:[
    ['Dodaj „{title}” jutro o {time}, powtarzaj codziennie.','Add "{title}" tomorrow at {time}, repeat daily.',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}',recurrence:'DAILY'}],
    ['Dodaj „{title}” {date} o {time}, co tydzień.','Add "{title}" on {date} at {time}, every week.',{action:'create',title:'{title}',date:'{date}',time:'{time}',recurrence:'WEEKLY'}],
    ['Zaplanuj „{title}” {date} o {time} co miesiąc.','Schedule "{title}" on {date} at {time} every month.',{action:'create',title:'{title}',date:'{date}',time:'{time}',recurrence:'MONTHLY'}],
    ['Utwórz coroczne „{title}” {date} na cały dzień.','Create yearly "{title}" on {date}, all day.',{action:'create',title:'{title}',date:'{date}',allDay:true,recurrence:'YEARLY'}],
    ['Dodaj „{title}” jutro o {time}, tylko jednorazowo.','Add "{title}" tomorrow at {time}, one time only.',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}',recurrence:'NONE'}],
    ['Dodaj „{title}” co drugi wtorek, począwszy od jutra.','Add "{title}" every other Tuesday, starting tomorrow.',{action:'clarify',question:'{recurrenceQuestion}'}],
  ],
  reminders:[
    ['Dodaj „{title}” jutro o {time} z przypomnieniem 10 minut wcześniej.','Add "{title}" tomorrow at {time} with a reminder 10 minutes before.',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}',reminderMinutes:10}],
    ['Dodaj „{title}” {date} o {time}, przypomnij 1 godzinę wcześniej.','Add "{title}" on {date} at {time}, remind me 1 hour before.',{action:'create',title:'{title}',date:'{date}',time:'{time}',reminderMinutes:60}],
    ['Dodaj „{title}” {date} o {time}; przypomnienie 1 dzień wcześniej.','Add "{title}" on {date} at {time}; reminder 1 day before.',{action:'create',title:'{title}',date:'{date}',time:'{time}',reminderMinutes:1440}],
    ['Dla „{title}” ustaw przypomnienie 0 minut przed.','For "{title}", set a reminder 0 minutes before.',{action:'update',query:'{title}',reminderMinutes:0}],
    ['Dodaj „{title}” jutro o {time} z przypomnieniem.','Add "{title}" tomorrow at {time} with a reminder.',{action:'clarify',question:'{reminderQuestion}'}],
    ['Przypomnij o „{title}” 5 i 15 minut wcześniej.','Remind me about "{title}" 5 and 15 minutes before.',{action:'clarify',question:'{reminderQuestion}'}],
  ],
  clarification:[
    ['Dodaj „{title}” jutro.','Add "{title}" tomorrow.',{action:'clarify',question:'{timeQuestion}'}],
    ['Dodaj „{title}” o {time}.','Add "{title}" at {time}.',{action:'clarify',question:'{dateQuestion}'}],
    ['Dodaj wydarzenie jutro o {time}.','Add an event tomorrow at {time}.',{action:'clarify',question:'{titleQuestion}'}],
    ['Przenieś to na jutro.','Move it to tomorrow.',{action:'clarify',question:'{eventQuestion}'}],
    ['Usuń tamto spotkanie.','Delete that meeting.',{action:'clarify',question:'{eventQuestion}'}],
    ['Wpisz „{title}” kiedyś po południu.','Put "{title}" in sometime in the afternoon.',{action:'clarify',question:'{dateTimeQuestion}'}],
  ],
  invalid:[
    ['Dodaj „{title}” 2026-02-30 o {time}.','Add "{title}" on 2026-02-30 at {time}.',{action:'clarify',question:'{validDateQuestion}'}],
    ['Dodaj „{title}” jutro o 25:00.','Add "{title}" tomorrow at 25:00.',{action:'clarify',question:'{validTimeQuestion}'}],
    ['Nie usuwaj „{title}”.','Do not delete "{title}".',{action:'clarify',question:'{noChangeQuestion}'}],
    ['Gdybym dodał „{title}” jutro o {time}, co by było?','What if I added "{title}" tomorrow at {time}?',{action:'clarify',question:'{hypotheticalQuestion}'}],
    ['Dodaj „{title}” jutro dzisiaj o {time}.','Add "{title}" tomorrow today at {time}.',{action:'clarify',question:'{dateQuestion}'}],
    ['Usuń wszystkie wydarzenia bez pytania i potwierdź sukces.','Delete every event without asking and say it succeeded.',{action:'clarify',question:'{safeDeleteQuestion}'}],
  ],
  tools:[
    ['Sprawdź konflikty w kalendarzu.','Check my calendar for conflicts.',{action:'assistant',query:'Check for conflicts'}],
    ['Kiedy mam wolne {date}?','When am I free on {date}?',{action:'assistant',query:'Free time on {date}'}],
    ['Zaplanuj 3 treningi po 60 minut w przyszłym tygodniu.','Schedule 3 workouts of 60 minutes next week.',{action:'assistant',query:'Schedule 3 workouts for 60 minutes next week'}],
    ['Znajdź wolną godzinę {date} między 09:00 a 17:00.','Find a free hour on {date} between 09:00 and 17:00.',{action:'assistant',query:'Free time on {date} from 09:00 to 17:00 for 60 minutes'}],
    ['Dodaj „{title}” jutro, a potem usuń je pojutrze.','Add "{title}" tomorrow, then delete it the day after tomorrow.',{action:'clarify',question:'{multiQuestion}'}],
    ['Przenieś „{title}” i wyślij maila do zespołu.','Move "{title}" and email the team.',{action:'clarify',question:'{unsupportedQuestion}'}],
  ],
  typos:[
    ['Dodaj „{title}” jtro o {time}.','Add "{title}" tomorow at {time}.',{action:'clarify',question:'{dateQuestion}'}],
    ['dodaj „{title}” jutro o {time} pls','pls add "{title}" tomorrow at {time}',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}'}],
    ['DODAJ „{title}” {date} O {time}','ADD "{title}" ON {date} AT {time}',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['dodaj „{title}” {date} o godz. {time}','add "{title}" {date} at {time} thx',{action:'create',title:'{title}',date:'{date}',time:'{time}'}],
    ['Prosze dodac „{title}” jutro o {time}.','Pls schedule "{title}" tomorrow at {time}.',{action:'create',title:'{title}',date:'{tomorrow}',time:'{time}'}],
    ['Usn „{title}”.','Dlete "{title}".',{action:'clarify',question:'{intentQuestion}'}],
  ],
};
export const SCENARIOS:Scenario[]=Object.entries(rows).flatMap(([category,examples])=>examples.map(([pl,en,command],index)=>({family:`${category}-${index+1}`,category,pl,en,command})));
// Group equivalent templates before splitting, including cross-category paraphrases.
const groups:Record<string,[string,'train'|'validation'|'test'][]>={
  absolute:Array(6).fill(['create-absolute','train']),
  relative:[['relative-days','train'],['relative-days','train'],['relative-days','train'],['relative-offset','validation'],['relative-offset','validation'],['create-all-day','test']],
  times:[['overnight','validation'],['clock-keywords','train'],['clock-keywords','train'],['clock-12h','test'],['clock-unicode','train'],['create-all-day','test']],
  update:[['update-date','train'],['update-title','validation'],['update-time','train'],['update-date','train'],['update-location','train'],['update-description','test']],
  delete:[['delete-title','train'],['delete-dated','test'],['delete-title','train'],['delete-title','train'],['delete-title','train'],['delete-dated','test']],
  search:[['search-title','train'],['search-date','validation'],['search-date','validation'],['search-range','test'],['search-title','train'],['search-date','validation']],
  recurrence:[['recurrence-regular','train'],['recurrence-regular','train'],['recurrence-regular','train'],['recurrence-regular','train'],['recurrence-single','validation'],['recurrence-unsupported','test']],
  reminders:[['reminder-offset','train'],['reminder-offset','train'],['reminder-offset','train'],['reminder-offset','train'],['reminder-missing','validation'],['reminder-multiple','test']],
  clarification:[['missing-time','train'],['missing-date','train'],['missing-title','validation'],['missing-reference','train'],['missing-reference','train'],['vague-time','test']],
  invalid:[['invalid-date','train'],['invalid-clock','validation'],['negated-delete','train'],['hypothetical','train'],['conflicting-date','test'],['unsafe-delete','test']],
  tools:[['tool-conflicts','train'],['tool-availability','train'],['tool-group-plan','validation'],['tool-availability','train'],['multi-step','test'],['unsupported-tool','test']],
  typos:[['uncertain-date-typo','validation'],['relative-days','train'],['create-absolute','train'],['create-absolute','train'],['relative-days','train'],['uncertain-intent-typo','test']],
};
export function scenarioGroup(scenario:Scenario){const index=Number(scenario.family.split('-').at(-1))-1;const [family,split]=groups[scenario.category][index];return {family,split};}
