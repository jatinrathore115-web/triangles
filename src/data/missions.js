// Mission configuration. Gameplay systems read ONLY from this data.
//
// target.by      'sides' | 'angles'  -> which classification decides correctness
// target.type    the classification the bridge needs
// options        frame ids shown in the yard, left -> right
// bridgeStage    bridge stage (bridgeLayout.js) the correct frame completes
// slotPanel      panel the crane delivers to; the rest of the stage assembles with it
// markings       'sides' (tick marks + lengths) | 'angles' (angle marks + degrees)
// hints          [clue text, marking-illuminate text, strong-guidance text]
// checkpoint     optional short construction checkpoint played after the mission

export const STAGES = {
  sides: { id: 'sides', label: 'STAGE 1 · SIDES', title: 'Side-based triangles' },
  angles: { id: 'angles', label: 'STAGE 2 · ANGLES', title: 'Angle-based triangles' },
};

export const MISSIONS = [
  {
    id: 'm1-isosceles',
    stage: 'sides',
    instruction: 'Choose a triangle with exactly 2 equal sides.',
    emphasis: 'exactly 2 equal sides',
    target: { by: 'sides', type: 'isosceles' },
    options: ['equilateral-6', 'isosceles-6-8-8', 'scalene-6-10-9'],
    bridgeStage: 'isosceles',
    slotPanel: 'iso-L',
    markings: 'sides',
    reinforcement: { title: 'Isosceles Triangle', body: 'Exactly 2 equal sides.', highlight: 'equalSides' },
    hints: [
      'Look for exactly 2 equal sides.',
      'Matching tick marks show equal sides.',
      'Glowing sides are equal. Which frame has exactly two?',
    ],
  },
  {
    id: 'm2-equilateral',
    stage: 'sides',
    instruction: 'Choose an equilateral triangle.',
    emphasis: 'equilateral',
    target: { by: 'sides', type: 'equilateral' },
    options: ['equilateral-12', 'isosceles-12-9.5', 'scalene-12-11-8'],
    bridgeStage: 'equilateral',
    slotPanel: 'equi-C',
    markings: 'sides',
    reinforcement: { title: 'Equilateral Triangle', body: 'All 3 sides are equal.', highlight: 'equalSides' },
    hints: [
      'Equilateral means all 3 sides are equal.',
      'Every side must carry the same tick mark.',
      'Glowing sides are equal. Which frame has all three?',
    ],
  },
  {
    id: 'm3-scalene',
    stage: 'sides',
    instruction: 'Choose a triangle where all 3 sides have different lengths.',
    emphasis: 'all 3 sides have different lengths',
    target: { by: 'sides', type: 'scalene' },
    options: ['isosceles-6-9-9', 'equilateral-6', 'scalene-6-10-9'],
    bridgeStage: 'scalene',
    slotPanel: 'scal-L',
    markings: 'sides',
    reinforcement: { title: 'Scalene Triangle', body: 'All 3 sides are different.', highlight: 'allSides' },
    hints: [
      'No two sides can be the same length.',
      'Different tick marks mean different lengths.',
      'Glowing sides are equal. Pick the frame with none.',
    ],
    checkpoint: {
      title: 'STAGE 1 COMPLETE',
      subtitle: 'Triangles classified by their sides',
      items: [
        { stage: 'isosceles', panel: 'iso-L' },
        { stage: 'equilateral', panel: 'equi-C' },
        { stage: 'scalene', panel: 'scal-R' },
      ],
      next: 'STAGE 2 · ANGLES',
    },
  },
  {
    id: 'm4-acute',
    stage: 'angles',
    instruction: 'Choose an acute-angled triangle.',
    emphasis: 'acute-angled',
    target: { by: 'angles', type: 'acute' },
    options: ['obtuse-8-10.5-4', 'right-8-10-6', 'acute-upper'],
    bridgeStage: 'acute',
    slotPanel: 'fill-2-L',
    markings: 'angles',
    reinforcement: { title: 'Acute Triangle', body: 'All 3 angles are less than 90°.', highlight: 'allAngles' },
    hints: [
      'Every angle must be less than 90°.',
      'Read each angle marked on the frames.',
      'The largest angle of each frame is lit. Is it under 90°?',
    ],
  },
  {
    id: 'm5-right',
    stage: 'angles',
    instruction: 'Choose a triangle with one 90° angle.',
    emphasis: 'one 90° angle',
    target: { by: 'angles', type: 'right' },
    options: ['right-6-4.5-7.5', 'obtuse-6-8.5-4', 'acute-6-6.5-5'],
    bridgeStage: 'right',
    slotPanel: 'right-L',
    markings: 'angles',
    reinforcement: { title: 'Right Triangle', body: 'One angle is exactly 90°.', highlight: 'rightAngle' },
    hints: [
      'Look for a square corner: exactly 90°.',
      'A small square symbol marks a 90° angle.',
      'The largest angle of each frame is lit. Which is exactly 90°?',
    ],
  },
  {
    id: 'm6-obtuse',
    stage: 'angles',
    instruction: 'Choose a triangle with one angle greater than 90°.',
    emphasis: 'greater than 90°',
    target: { by: 'angles', type: 'obtuse' },
    options: ['acute-9-8-7', 'obtuse-lower', 'right-8-10-6'],
    bridgeStage: 'obtuse',
    slotPanel: 'fill-1-L',
    markings: 'angles',
    reinforcement: { title: 'Obtuse Triangle', body: 'One angle is greater than 90°.', highlight: 'largestAngle' },
    hints: [
      'Look for one wide, open angle.',
      'An obtuse angle measures more than 90°.',
      'The largest angle of each frame is lit. Which is over 90°?',
    ],
  },
];

export const TOTAL_MISSIONS = MISSIONS.length;
