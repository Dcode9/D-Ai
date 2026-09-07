export interface StretchShape {
  id: number;
  name: string;
  capW: number;
  viewH: number;
  outerTopY: number;
  outerBottomY: number;
  innerTopY: number;
  innerBottomY: number;
  outer: string;
  inner: string;
}

export const STRETCH_SHAPES: StretchShape[] = [
  {
    id: 1,
    name: "Shape 1",
    capW: 88,
    viewH: 100,
    outerTopY: 16,
    outerBottomY: 92,
    innerTopY: 22,
    innerBottomY: 86,
    outer:
      "M88 16 H49 Q44 16 41 20 L39 24 H30 V33 H20 Q15 33 13 40 L12 47 Q4 48 0 54 Q4 60 12 61 L13 68 Q15 76 24 76 H30 V84 H40 Q43 84 46 88 Q49 92 56 92 H88",
    inner:
      "M88 22 H53 Q48 22 45 26 L42 31 H33 V39 H23 Q20 39 19 45 L18 50 Q10 51 7 54 Q10 57 18 58 L19 65 Q20 70 26 70 H33 V78 H43 Q47 78 50 82 Q53 86 59 86 H88",
  },
  {
    id: 2,
    name: "Shape 2",
    capW: 91,
    viewH: 110,
    outerTopY: 16,
    outerBottomY: 102,
    innerTopY: 22,
    innerBottomY: 96,
    outer:
      "M91 16 H52 Q45 16 40 21 Q37 25 35 31 H28 Q20 31 17 38 Q14 45 13 48 L3 59 L13 70 Q14 73 17 80 Q20 87 28 87 H35 Q37 93 40 97 Q45 102 52 102 H91",
    inner:
      "M91 22 H55 Q49 22 45 26 Q42 31 40 37 H31 Q25 37 23 42 Q20 48 20 52 L10 59 L20 66 Q20 70 23 76 Q25 81 31 81 H40 Q42 87 45 92 Q49 96 55 96 H91",
  },
  {
    id: 3,
    name: "Shape 3",
    capW: 82,
    viewH: 100,
    outerTopY: 18,
    outerBottomY: 92,
    innerTopY: 24,
    innerBottomY: 86,
    outer: "M82 18 H55 Q47 18 40 23 Q34 28 29 36 L2 55 L29 74 Q34 82 40 87 Q47 92 55 92 H82",
    inner: "M82 24 H58 Q50 24 44 28 Q39 32 34 41 L10 55 L34 69 Q39 78 44 82 Q50 86 58 86 H82",
  },
  {
    id: 4,
    name: "Shape 4",
    capW: 91,
    viewH: 112,
    outerTopY: 17,
    outerBottomY: 107,
    innerTopY: 23,
    innerBottomY: 101,
    outer:
      "M91 17 H54 Q47 17 42 21 Q38 25 36 33 V37 Q28 37 23 41 Q18 45 16 53 L4 62 L16 71 Q18 79 23 83 Q28 87 36 87 V91 Q38 99 42 103 Q47 107 54 107 H91",
    inner:
      "M91 23 H56 Q51 23 47 26 Q43 30 42 37 V43 Q33 43 28 47 Q24 51 22 58 L12 62 L22 66 Q24 73 28 77 Q33 81 42 81 V87 Q43 94 47 98 Q51 101 56 101 H91",
  },
  {
    id: 5,
    name: "Shape 5",
    capW: 96,
    viewH: 112,
    outerTopY: 18,
    outerBottomY: 110,
    innerTopY: 24,
    innerBottomY: 104,
    outer:
      "M96 18 H57 Q50 18 46 22 Q43 26 42 33 H34 Q29 33 26 37 Q24 41 23 47 L5 64 L23 81 Q24 87 26 91 Q29 95 34 95 H42 Q43 102 46 106 Q50 110 57 110 H96",
    inner:
      "M96 24 H60 Q54 24 51 27 Q48 31 47 38 H38 Q34 38 32 41 Q29 45 29 51 L14 64 L29 77 Q29 83 32 87 Q34 90 38 90 H47 Q48 97 51 101 Q54 104 60 104 H96",
  },
  {
    id: 6,
    name: "Shape 6",
    capW: 102,
    viewH: 118,
    outerTopY: 16,
    outerBottomY: 116,
    innerTopY: 22,
    innerBottomY: 110,
    outer:
      "M102 16 H58 Q50 16 47 23 Q45 27 45 34 Q37 31 29 32 Q20 33 16 42 Q12 51 9 60 L2 66 L9 72 Q12 81 16 90 Q20 99 29 100 Q37 101 45 98 Q45 105 47 109 Q50 116 58 116 H102",
    inner:
      "M102 22 H61 Q55 22 53 27 Q51 31 51 41 Q41 37 32 38 Q25 39 22 46 Q18 54 16 62 L10 66 L16 70 Q18 78 22 86 Q25 93 32 94 Q41 95 51 91 Q51 101 53 105 Q55 110 61 110 H102",
  },
  {
    id: 7,
    name: "Shape 7",
    capW: 92,
    viewH: 118,
    outerTopY: 18,
    outerBottomY: 116,
    innerTopY: 24,
    innerBottomY: 110,
    outer:
      "M92 18 H54 Q48 18 44 22 Q40 26 39 33 H31 Q22 33 17 41 Q12 48 9 58 L2 67 L9 76 Q12 86 17 93 Q22 101 31 101 H39 Q40 108 44 112 Q48 116 54 116 H92",
    inner:
      "M92 24 H57 Q52 24 49 27 Q45 31 45 39 H35 Q27 39 23 45 Q19 51 17 60 L10 67 L17 74 Q19 83 23 89 Q27 95 35 95 H45 Q45 103 49 107 Q52 110 57 110 H92",
  },
  {
    id: 8,
    name: "Shape 8",
    capW: 94,
    viewH: 116,
    outerTopY: 16,
    outerBottomY: 114,
    innerTopY: 22,
    innerBottomY: 108,
    outer:
      "M94 16 H56 Q45 16 39 24 Q34 31 34 43 L34 50 L5 65 L34 80 L34 87 Q34 99 39 106 Q45 114 56 114 H94",
    inner:
      "M94 22 H59 Q50 22 45 29 Q40 36 40 46 L40 55 L15 65 L40 75 L40 84 Q40 94 45 101 Q50 108 59 108 H94",
  },
];

interface Command {
  cmd: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cx?: number;
  cy?: number;
}

function parsePathToCommands(d: string): Command[] {
  const commands: Command[] = [];
  const regex = /([MLHVQCSTAZ])([^MLHVQCSTAZ]*)/gi;
  let match: RegExpExecArray | null;
  let curX = 0;
  let curY = 0;

  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1].toUpperCase();
    const args = match[2].trim().split(/[ ,]+/).filter(Boolean).map(Number);
    const startX = curX;
    const startY = curY;

    if (cmd === "M" || cmd === "L") {
      curX = args[0];
      curY = args[1];
      commands.push({ cmd, startX, startY, endX: curX, endY: curY });
    } else if (cmd === "H") {
      curX = args[0];
      commands.push({ cmd: "H", startX, startY, endX: curX, endY: curY });
    } else if (cmd === "V") {
      curY = args[0];
      commands.push({ cmd: "V", startX, startY, endX: curX, endY: curY });
    } else if (cmd === "Q") {
      const cx = args[0];
      const cy = args[1];
      curX = args[2];
      curY = args[3];
      commands.push({ cmd: "Q", startX, startY, endX: curX, endY: curY, cx, cy });
    }
  }
  return commands;
}

/**
 * Builds a single, continuous, airtight closed SVG path combining:
 * 1. Left ornate cap (top-to-bottom)
 * 2. Bottom connecting rail
 * 3. Right ornate cap mirrored (bottom-to-top)
 * 4. Top connecting rail
 * 5. Closed with Z
 *
 * Guaranteed 0 gaps, 0 disconnections, and serves as the exact clipping contour for fills.
 */
export function buildClosedFramePath(
  rawD: string,
  _capW: number,
  width: number,
  capScale: number,
  capTop: number,
): string {
  const cmds = parsePathToCommands(rawD);
  if (cmds.length === 0) return "";

  const leftStart = { x: cmds[0].endX * capScale, y: capTop + cmds[0].endY * capScale };
  const leftEnd = {
    x: cmds[cmds.length - 1].endX * capScale,
    y: capTop + cmds[cmds.length - 1].endY * capScale,
  };

  // 1. Left cap forward (top to bottom)
  let path = "";
  cmds.forEach((c, idx) => {
    if (idx === 0) {
      path += `M ${c.endX * capScale} ${capTop + c.endY * capScale} `;
    } else if (c.cmd === "L") {
      path += `L ${c.endX * capScale} ${capTop + c.endY * capScale} `;
    } else if (c.cmd === "H") {
      path += `H ${c.endX * capScale} `;
    } else if (c.cmd === "V") {
      path += `V ${capTop + c.endY * capScale} `;
    } else if (c.cmd === "Q") {
      path += `Q ${(c.cx ?? 0) * capScale} ${capTop + (c.cy ?? 0) * capScale} ${c.endX * capScale} ${capTop + c.endY * capScale} `;
    }
  });

  // 2. Bottom rail connecting left cap bottom to right cap bottom
  const rightEnd = { x: width - leftEnd.x, y: leftEnd.y };
  const rightStart = { x: width - leftStart.x, y: leftStart.y };
  path += `L ${rightEnd.x} ${rightEnd.y} `;

  // 3. Right cap mirrored in reverse (from bottom up to top)
  for (let i = cmds.length - 1; i >= 1; i--) {
    const c = cmds[i];
    const prevPt = { x: width - c.startX * capScale, y: capTop + c.startY * capScale };
    if (c.cmd === "L" || c.cmd === "H" || c.cmd === "V") {
      path += `L ${prevPt.x} ${prevPt.y} `;
    } else if (c.cmd === "Q") {
      const mirroredCx = width - (c.cx ?? 0) * capScale;
      const mirroredCy = capTop + (c.cy ?? 0) * capScale;
      path += `Q ${mirroredCx} ${mirroredCy} ${prevPt.x} ${prevPt.y} `;
    }
  }

  // 4. Top rail connecting right cap top back to left cap top, then close
  path += `L ${leftStart.x} ${leftStart.y} Z`;
  return path;
}
