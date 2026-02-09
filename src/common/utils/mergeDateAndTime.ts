/**
 * Merge a date string and time string into a single Date object
 * Supports both 24-hour (HH:mm) and 12-hour (h:mm AM/PM) formats
 */
export function mergeDateAndTime(dateStr: string, timeStr: string): Date {
    const datePart = new Date(dateStr);

    let hours = 0;
    let minutes = 0;
    const time = timeStr.trim().toUpperCase();

    const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    if (!match) throw new Error("Invalid time format");

    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2] || '0', 10);

    const ampm = match[3];
    if (ampm) {
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
    }

    datePart.setHours(hours);
    datePart.setMinutes(minutes);
    datePart.setSeconds(0);
    datePart.setMilliseconds(0);

    return datePart;
}


