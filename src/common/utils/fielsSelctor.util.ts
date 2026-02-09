// ✅ fieldSelector util
const fieldSelector = (fields: string | undefined, allowed: string[]): string => {
    if (!fields) return ''; // if no fields requested, return empty string

    return fields
        .split(',') // split by comma
        .map(f => f.trim()) // remove spaces
        .filter(f => allowed.includes(f)) // only keep allowed fields
        .join(' '); // return space separated string for mongoose .select()
};


export default fieldSelector;