// Extract explicit reminder offsets only; defaults remain owned by the calendar.
export function requestedReminderMinutes(request:string):number|undefined {
  const text=request.replace(/"[^"]*"|„[^”]*”|“[^”]*”|«[^»]*»/gu,'').toLocaleLowerCase();
  if(!/remind|notification|przypomn|powiadom|напом|уведом|erinner|benachrichtig/iu.test(text))return;
  if(/\d+\s*(?:i|and|,|or|lub)\s*\d+\s*(?:min|godzin|hours?|days?|dni|dzie)/iu.test(text))return;
  const matches=[...text.matchAll(/\b(\d{1,6})\s*(minut\p{L}*|mins?|godzin\p{L}*|hours?|hrs?|h|dni|dzie[ńn]|days?|дн\p{L}*|час\p{L}*|мин\p{L}*|tag\p{L}*|stund\p{L}*)\s*(?:wcze[śs]niej|przed|before|earlier|vorher|zuvor|раньше|до)/giu)];
  if(matches.length===1){const unit=matches[0][2],factor=/^min|^мин/iu.test(unit)?1:/^godzin|^h|^час|^stund/iu.test(unit)?60:1440;const value=Number(matches[0][1])*factor;return Number.isSafeInteger(value)&&value<=525600?value:undefined;}
  if(matches.length)return;
  if(/\b(?:day before|dzie[ńn] wcze[śs]niej|dzien wcze[śs]niej|tag vorher|день раньше)\b/iu.test(text))return 1440;
  if(/\b(?:an? hour before|godzin[ęe] wcze[śs]niej|stunde vorher|час раньше)\b/iu.test(text))return 60;
}
