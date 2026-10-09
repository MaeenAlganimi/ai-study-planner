import type { Syllabus } from "./schemas";

/** The day the bundled CS 301 term is designed to be opened on. */
export const SAMPLE_PLAN_ANCHOR = "2026-10-09";

export const SAMPLE_SYLLABUS: Syllabus = {
  courseCode: "CS 301",
  courseTitle: "Data Structures and Algorithms",
  instructor: "Dr. Lena Okonkwo",
  term: "Fall 2026",
  summary:
    "Students implement core data structures, write running-time arguments, and finish with an individual graph visualizer. Office hours are Tuesdays and Thursdays, 2:00–3:30 p.m. in Room 214. Late work loses 10% per day for four days. Assignments are 24% combined, the quiz is 10%, the project is 16%, the midterm is 25%, and the final exam is 25%.",
  topics: [
    {
      id: "asymptotics",
      title: "Asymptotic analysis",
      description: "Big-O, big-Theta, and bounding loops and recursive functions.",
      weekLabel: "Week 1",
    },
    {
      id: "arrays",
      title: "Arrays and amortized analysis",
      description: "Dynamic arrays, doubling, and aggregate analysis.",
      weekLabel: "Week 2",
    },
    {
      id: "lists",
      title: "Linked lists and stacks",
      description: "Singly and doubly linked lists, and stack-based evaluation.",
      weekLabel: "Week 3",
    },
    {
      id: "queues",
      title: "Queues and recursion",
      description: "Circular queues, tail recursion, and the call stack.",
      weekLabel: "Week 4",
    },
    {
      id: "trees",
      title: "Trees and binary search trees",
      description: "Traversals, insertion, and deletion.",
      weekLabel: "Week 5",
    },
    {
      id: "avl",
      title: "AVL trees and heaps",
      description: "Rotations, the heap property, and priority queues.",
      weekLabel: "Week 6",
    },
    {
      id: "hashing",
      title: "Hash tables",
      description: "Chaining, open addressing, and choosing a hash function.",
      weekLabel: "Week 7",
    },
    {
      id: "graphs",
      title: "Graphs and traversal",
      description: "Representations, breadth-first search, and depth-first search.",
      weekLabel: "Week 8",
    },
    {
      id: "paths",
      title: "Shortest paths",
      description: "Dijkstra's algorithm and when it does not apply.",
      weekLabel: "Week 9",
    },
    {
      id: "sorting",
      title: "Sorting",
      description: "Mergesort, quicksort, and the comparison lower bound.",
      weekLabel: "Week 10",
    },
    {
      id: "dp",
      title: "Dynamic programming",
      description: "Overlapping subproblems, memoization, and tabulation.",
      weekLabel: "Week 11",
    },
  ],
  assessments: [
    {
      id: "a1",
      title: "Complexity exercises",
      type: "assignment",
      dueDate: "2026-09-12",
      weight: 8,
      topicIds: ["asymptotics"],
    },
    {
      id: "a2",
      title: "Linked structures",
      type: "assignment",
      dueDate: "2026-09-26",
      weight: 8,
      topicIds: ["lists"],
    },
    {
      id: "quiz1",
      title: "Foundations quiz",
      type: "quiz",
      dueDate: "2026-10-02",
      weight: 10,
      topicIds: ["asymptotics", "arrays", "lists", "queues"],
    },
    {
      id: "midterm",
      title: "Midterm exam",
      type: "exam",
      dueDate: "2026-10-22",
      weight: 25,
      topicIds: ["asymptotics", "arrays", "lists", "queues", "trees", "avl", "hashing"],
    },
    {
      id: "a3",
      title: "Hashing problems",
      type: "assignment",
      dueDate: "2026-11-06",
      weight: 8,
      topicIds: ["hashing"],
    },
    {
      id: "project",
      title: "Graph visualizer",
      type: "project",
      dueDate: "2026-11-20",
      weight: 16,
      topicIds: ["graphs", "paths"],
    },
    {
      id: "final",
      title: "Cumulative final exam",
      type: "exam",
      dueDate: "2026-12-10",
      weight: 25,
      topicIds: [
        "asymptotics",
        "arrays",
        "lists",
        "queues",
        "trees",
        "avl",
        "hashing",
        "graphs",
        "paths",
        "sorting",
        "dp",
      ],
    },
  ],
};

export function isSampleSyllabusText(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  return (
    /cs\s*301/.test(normalized) &&
    normalized.includes("lena okonkwo") &&
    normalized.includes("graph visualizer")
  );
}

/**
 * If today sits inside the uploaded term, plan from today. Otherwise replay the
 * sample term from its anchor day so the demo still has upcoming work.
 */
export function defaultStartDate(syllabus: Syllabus, today: string): string {
  const dueDates = syllabus.assessments.map((assessment) => assessment.dueDate).sort();
  const first = dueDates[0];
  const last = dueDates[dueDates.length - 1];
  if (!first || !last) return today;
  if (today < first || today > last) return SAMPLE_PLAN_ANCHOR;
  return today;
}
