/** Vertical margin around exported tables and bordered blocks (~0.75rem). */
const EXPORT_ELEMENT_MARGIN_V_PT = 14;

/** Inner padding inside bordered blocks. */
const EXPORT_BLOCK_PAD_V_PT = 10;
const EXPORT_BLOCK_PAD_H_PT = 14;

const TWIP_PER_PT = 20;

function marginTwip(pt = EXPORT_ELEMENT_MARGIN_V_PT) {
  return Math.round(pt * TWIP_PER_PT);
}

function blockPadTwip() {
  return {
    top: marginTwip(EXPORT_BLOCK_PAD_V_PT),
    bottom: marginTwip(EXPORT_BLOCK_PAD_V_PT),
    left: marginTwip(EXPORT_BLOCK_PAD_H_PT),
    right: marginTwip(EXPORT_BLOCK_PAD_H_PT)
  };
}

module.exports = {
  EXPORT_ELEMENT_MARGIN_V_PT,
  EXPORT_BLOCK_PAD_V_PT,
  EXPORT_BLOCK_PAD_H_PT,
  marginTwip,
  blockPadTwip
};
