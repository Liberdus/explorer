<!-- 93b4b65a-5f32-4c0d-bdce-ece8ab9b796d 61fc15bb-b5df-4017-84cd-2e70483cd8d5 -->
# Reorder InfoPanel Statistics Display

## Overview

Update 6 DetailChart components to display the highest value before the lowest value in their infoPanel sections for consistency.


Update the order of value highlights (highest before lowest) in the infoPanel sections of the all detail chart components for consistency.

## Files to Update

1. **DailyAccountChart.tsx** (lines 101-134)

- Swap the highest and lowest highlight sections

2. **DailyActiveAccountChart.tsx** (lines 79-112)

- Swap the highest and lowest highlight sections

3. **DailyAvgTransactionFeeChart.tsx** (lines 91-126)

- Swap the highest and lowest highlight sections

4. **DailyBurntSupplyChart.tsx** (lines 96-129)

- Swap the highest and lowest highlight sections

5. **DailyDistributedSupplyChart.tsx** (lines 92-126)

- Swap the highest and lowest highlight sections

6. **DailyTransactionFeeChart.tsx** (lines 80-113)

- Swap the highest and lowest highlight sections

## Implementation

For each file, reorder the JSX blocks so that the `{highest && ...}` conditional render appears before the `{lowest && ...}` conditional render within the infoPanelContent section.