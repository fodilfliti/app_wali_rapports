/** Tables with more than this many data rows start on a new portrait page. */
const TABLE_PORTRAIT_ROW_THRESHOLD = 3;

function tableNeedsPortraitPage(rows) {
  return (rows || []).length > TABLE_PORTRAIT_ROW_THRESHOLD;
}

module.exports = {
  TABLE_PORTRAIT_ROW_THRESHOLD,
  tableNeedsPortraitPage
};
