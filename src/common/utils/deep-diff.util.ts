// src/common/utils/deep-diff.util.ts
// export function deepDiff(
//   oldObj: Record<string, any>,
//   newObj: Record<string, any>,
//   ignoreKeys: string[] = ['_id', 'createdAt', 'updatedAt', '__v'],
// ): Record<string, { oldValue: any; newValue: any }> {
//   const changes: Record<string, { oldValue: any; newValue: any }> = {};

//   const compare = (oldVal: any, newVal: any, path: string) => {
//     // Ignore meta keys
//     if (ignoreKeys.includes(path.split('.').pop()!)) return;

//     if (Array.isArray(oldVal) && Array.isArray(newVal)) {
//       if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
//         changes[path] = { oldValue: oldVal, newValue: newVal };
//       }
//       return;
//     }

//     if (
//       typeof oldVal === 'object' &&
//       typeof newVal === 'object' &&
//       oldVal &&
//       newVal
//     ) {
//       const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
//       for (const key of allKeys) {
//         compare(oldVal[key], newVal[key], `${path}.${key}`);
//       }
//       return;
//     }

//     if (oldVal !== newVal) {
//       changes[path] = { oldValue: oldVal, newValue: newVal };
//     }
//   };

//   const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
//   for (const key of allKeys) {
//     compare(oldObj[key], newObj[key], key);
//   }

//   return changes;
// }


export function deepDiff(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  ignoreKeys: string[] = ['_id', 'createdAt', 'updatedAt', '__v'],
): Record<string, { oldValue: any; newValue: any }> {
  const changes: Record<string, { oldValue: any; newValue: any }> = {};

  const isObject = (val: any) =>
    val && typeof val === 'object' && !Array.isArray(val);

  const compare = (oldVal: any, newVal: any, path: string) => {
    if (ignoreKeys.includes(path.split('.').pop()!)) return;

    // 🧩 Handle array of objects (like tiers)
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      // If array of primitives
      if (typeof oldVal[0] !== 'object' || typeof newVal[0] !== 'object') {
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes[path] = { oldValue: oldVal, newValue: newVal };
        }
        return;
      }

      // If array of objects — find changes intelligently by key (name)
      const oldByName = new Map(oldVal.map((i: any) => [i.name, i]));
      const newByName = new Map(newVal.map((i: any) => [i.name, i]));

      // Detect added/removed tiers
      for (const [name, newTier] of newByName.entries()) {
        if (!oldByName.has(name)) {
          changes[`${path}.added:${name}`] = {
            oldValue: null,
            newValue: newTier,
          };
        }
      }
      for (const [name, oldTier] of oldByName.entries()) {
        if (!newByName.has(name)) {
          changes[`${path}.removed:${name}`] = {
            oldValue: oldTier,
            newValue: null,
          };
        }
      }

      // Detect modified tiers
      for (const [name, oldTier] of oldByName.entries()) {
        const newTier = newByName.get(name);
        if (newTier) {
          const keys = new Set([...Object.keys(oldTier), ...Object.keys(newTier)]);
          for (const key of keys) {
            if (oldTier[key] !== newTier[key]) {
              changes[`${path}.${name}.${key}`] = {
                oldValue: oldTier[key],
                newValue: newTier[key],
              };
            }
          }
        }
      }
      return;
    }

    // 🧩 Handle nested objects
    if (isObject(oldVal) && isObject(newVal)) {
      const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
      for (const key of keys) {
        compare(oldVal[key], newVal[key], `${path}.${key}`);
      }
      return;
    }

    // 🧩 Primitive values
    if (oldVal !== newVal) {
      changes[path] = { oldValue: oldVal, newValue: newVal };
    }
  };

  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  for (const key of keys) {
    compare(oldObj[key], newObj[key], key);
  }

  return changes;
}

