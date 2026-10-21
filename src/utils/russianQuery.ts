/** Normalize only Russian command/date grammar; event names remain user data. */
export function normalizeRussianInput(input: string): string {
  let text = input;
  const counts: Record<string, number> = { два: 2, две: 2, три: 3, четыре: 4, пять: 5 };
  const phrases: [string, string][] = [
    ['на час позже', 'actually one hour later'], ['на час раньше', 'actually one hour earlier'],
    ['на следующую неделю', 'next week'], ['на следующей неделе', 'next week'],
    ['на этой неделе', 'this week'], ['в этом месяце', 'this month'], ['в следующем месяце', 'next month'],
    ['когда я свободен', 'when am I free'], ['когда я свободна', 'when am I free'],
    ['когда у меня свободное время', 'when do I have free time'],
    ['что у меня', 'what do I have'], ['мое расписание', 'my schedule'], ['моё расписание', 'my schedule'],
    ['проверь конфликты', 'check conflicts'], ['проверь пересечения', 'check conflicts'],
    ['последняя пятница месяца', 'last Friday of month'], ['последнюю пятницу месяца', 'last Friday of month'],
    ['весь день', 'all day'], ['на час', 'for 1 hour'], ['на полчаса', 'for 30 minutes'],
    ['каждый день', 'every day'], ['каждую неделю', 'every week'], ['каждый месяц', 'every month'],
    ['в понедельник', 'on Monday'], ['во вторник', 'on Tuesday'], ['в среду', 'on Wednesday'],
    ['в четверг', 'on Thursday'], ['в пятницу', 'on Friday'], ['в субботу', 'on Saturday'], ['в воскресенье', 'on Sunday'],
  ];
  for (const [from, to] of phrases) text = text.replace(new RegExp(`(?<![\\p{L}])${from}(?![\\p{L}])`, 'giu'), to);
  text = text.replace(/(?:в|во)\s+(\d{1,2}(?::\d{2})?)/giu, 'at $1')
    .replace(/на\s+(\d+)\s*(минут[а-яё]*|час[а-яё]*)/giu, (_, n, unit) => `for ${n} ${unit.startsWith('мин') ? 'minutes' : 'hours'}`)
    .replace(/через\s+(\d+|два|две|три|четыре|пять)\s+(дн[а-яё]*|недел[а-яё]*)/giu, (_, n, unit) => `in ${counts[n.toLowerCase()] || n} ${unit.startsWith('недел') ? 'weeks' : 'days'}`);
  const words: Record<string, string> = {
    добавь: 'Add', добавьте: 'Add', создай: 'Create', запланируй: 'Schedule', найди: 'Find', поиск: 'Search',
    перенеси: 'Move', перенесите: 'Move', передвинь: 'Move', покажи: 'Show', подведи: 'Summary', итоги: 'Summary',
    сегодня: 'today', завтра: 'tomorrow', послезавтра: 'day after tomorrow',
    понедельник: 'Monday', вторник: 'Tuesday', среда: 'Wednesday', среду: 'Wednesday', четверг: 'Thursday', пятница: 'Friday', пятницу: 'Friday', суббота: 'Saturday', субботу: 'Saturday', воскресенье: 'Sunday',
    январь: 'January', января: 'January', февраль: 'February', февраля: 'February', март: 'March', марта: 'March',
    апрель: 'April', апреля: 'April', май: 'May', мая: 'May', июнь: 'June', июня: 'June', июль: 'July', июля: 'July',
    август: 'August', августа: 'August', сентябрь: 'September', сентября: 'September', октябрь: 'October', октября: 'October',
    ноябрь: 'November', ноября: 'November', декабрь: 'December', декабря: 'December',
    выходные: 'weekend', выходных: 'weekend', неделю: 'week', недели: 'week', месяц: 'month', месяца: 'month',
    свободен: 'free time', свободна: 'free time', свободное: 'free time',
    два: 'two', две: 'two', три: 'three', четыре: 'four', пять: 'five',
    часовые: 'one-hour', часовую: 'one-hour', часов: 'hours', часа: 'hours', минут: 'minutes', минуты: 'minutes',
    привет: 'hello', здравствуйте: 'hello', спасибо: 'thanks', на: 'to', от: 'from', до: 'to',
  };
  return text.replace(/[А-Яа-яЁё]+/gu, word => words[word.toLowerCase()] || word);
}
