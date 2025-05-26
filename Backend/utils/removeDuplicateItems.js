/**
 * Removes duplicate items based on creditor name, account number, and issue type
 * @param {Array} items - Array of disputable items
 * @returns {Array} - Array of unique items
 */
// Keep this for now
export function removeDuplicateItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.creditor_name}_${item.account_number}_${item.issue_type}_${item.issue_details}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}