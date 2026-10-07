/** Join truthy class names. */
export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
