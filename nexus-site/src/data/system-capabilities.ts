/**
 * SYSTEM CAPABILITIES DATA — Engineering systems specifications
 *
 * Migrated from department HTML pages to centralized data structure.
 * Contains descriptions, capabilities, tools, and team associations for each system.
 */

import type { DeptKey, TeamYear } from './team-data';
import { TEAMS } from './team-data';

/**
 * Active roster source — the public Team page swaps this to the
 * database roster once a successful query returns data. Defaults to
 * the static team-data so the page works before Supabase is set up.
 */
let activeTeams: Record<number, TeamYear> = TEAMS;

/** called by team-archive.ts when the database roster loads */
export function setActiveRosterSource(teams: Record<number, TeamYear>): void {
  activeTeams = teams;
}

export interface SystemCapability {
  name: string;
  description: string;
  coreFunctions: string[];
  tools: string[];
  // Members populated dynamically from team data
  getMembers: () => Array<{
    name: string;
    role: string;
    photoBase?: string;
    objectPosition?: string;
  }>;
}

/**
 * Mechanical Systems — migrated from mechanical.html
 */
const mechanicalCapability: SystemCapability = {
  name: 'MECHANICAL SYSTEMS',
  description: 'From concept to competition-ready hardware, the Mechanical Systems division designs, prototypes and manufactures the physical architecture behind every Nexus robot. We transform innovative concepts into precision-engineered machines using advanced CAD software and state-of-the-art fabrication techniques.',
  coreFunctions: [
    'Design & Modeling',
    'Structural Engineering',
    'Fabrication',
    'Assembly',
    'Testing & Iteration'
  ],
  tools: ['SolidWorks', 'Fusion 360', 'AutoCAD', 'CATIA', 'ANSYS', '3D Printing (FDM/SLA)', 'CNC Machining', 'Laser Cutting', 'Welding & Fabrication'],
  getMembers: () => {
    const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
    for (const yearData of Object.values(activeTeams)) {
      for (const member of yearData.members) {
        if (member.departments.includes('mech')) {
          members.push({
            name: member.name,
            role: member.roles.join(' · '),
            photoBase: member.photoBase,
            objectPosition: member.objectPosition
          });
        }
      }
    }
    return members;
  }
};

/**
 * Electronics Systems — migrated from electronics.html
 */
const electronicsCapability: SystemCapability = {
  name: 'ELECTRONICS SYSTEMS',
  description: 'Circuit design, PCB development, and power management systems that bring the robot to life. Our Electronics team engineers custom PCBs, manages power distribution, integrates diverse sensors, and ensures reliable communication between all robot subsystems.',
  coreFunctions: [
    'PCB Design',
    'Circuit Simulation',
    'Power Systems',
    'Sensors & Actuators',
    'Wiring Harnesses'
  ],
  tools: ['Altium Designer', 'KiCad', 'Eagle PCB', 'LTspice', 'ARM Cortex', 'ESP32', 'STM32', 'Arduino', 'I2C, SPI, UART', 'CAN Bus', 'Bluetooth/WiFi', 'LoRa'],
  getMembers: () => {
    const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
    for (const yearData of Object.values(activeTeams)) {
      for (const member of yearData.members) {
        if (member.departments.includes('elec')) {
          members.push({
            name: member.name,
            role: member.roles.join(' · '),
            photoBase: member.photoBase,
            objectPosition: member.objectPosition
          });
        }
      }
    }
    return members;
  }
};

/**
 * Embedded Systems — migrated from programming.html
 */
const embeddedCapability: SystemCapability = {
  name: 'EMBEDDED SYSTEMS',
  description: 'Firmware development and microcontroller programming that control robot behavior and autonomy. We develop sophisticated algorithms for autonomous navigation, implement computer vision systems, and create precise control systems for optimal robot performance.',
  coreFunctions: [
    'Firmware Development',
    'Sensor Integration',
    'Motor Control',
    'Communication Protocols',
    'Real-Time Processing'
  ],
  tools: ['Python', 'C++', 'JavaScript/Node.js', 'MATLAB', 'OpenCV', 'TensorFlow/PyTorch', 'ROS/ROS2', 'NumPy/SciPy', 'Deep Learning', 'SLAM', 'Kalman Filters', 'Path Planning (A*, RRT)'],
  getMembers: () => {
    const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
    for (const yearData of Object.values(activeTeams)) {
      for (const member of yearData.members) {
        if (member.departments.includes('embed')) {
          members.push({
            name: member.name,
            role: member.roles.join(' · '),
            photoBase: member.photoBase,
            objectPosition: member.objectPosition
          });
        }
      }
    }
    return members;
  }
};

/**
 * Automation — migrated from image-processing.html, broadened Aug 2026
 * from "Image Processing / MATLAB" to the full autonomy stack: navigation,
 * control, sensor fusion, perception-driven decision making.
 */
const automationCapability: SystemCapability = {
  name: 'AUTOMATION',
  description: 'The autonomy stack behind every Nexus robot — we fuse sensors, cameras and encoders into a coherent world model, plan paths through dynamic arenas, and close the control loops that turn decisions into precise motion. From MATLAB/Simulink simulation to on-board vision and ROS nodes, this division owns everything between "the robot sees" and "the robot acts".',
  coreFunctions: [
    'Autonomous Navigation',
    'Control Systems & Feedback',
    'Sensor Integration & Fusion',
    'Path Planning',
    'Perception & Decision Making'
  ],
  tools: ['Python', 'C++ for Real-Time Systems', 'MATLAB & Simulink', 'ROS / ROS 2', 'OpenCV', 'YOLO & Object Detection Models', 'Kalman Filters & Tracking', 'TensorFlow / PyTorch', 'PID & State-Machine Control', 'Path Planning (A*, RRT)', 'SLAM & Localization', 'Sensor Fusion'],
  getMembers: () => {
    const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
    for (const yearData of Object.values(activeTeams)) {
      for (const member of yearData.members) {
        if (member.departments.includes('auto')) {
          members.push({
            name: member.name,
            role: member.roles.join(' · '),
            photoBase: member.photoBase,
            objectPosition: member.objectPosition
          });
        }
      }
    }
    return members;
  }
};

/**
 * PR & Marketing — migrated from management.html
 */
const prmCapability: SystemCapability = {
  name: 'PR & MARKETING',
  description: 'Brand presence, sponsorship relations, and outreach that connect Nexus with the community and industry partners. Our team drives success through sponsorship acquisition, event coordination, creative design, and strategic team management.',
  coreFunctions: [
    'Brand Management',
    'Sponsor Relations',
    'Event Coordination',
    'Social Media',
    'Publicity'
  ],
  tools: ['Adobe Creative Suite', 'Social Media Platforms', 'Content Management', 'Analytics Tools', 'Budget Planning', 'Expense Tracking', 'Sponsorship Proposals', 'Financial Reporting', 'Timeline Planning', 'Resource Allocation'],
  getMembers: () => {
    const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
    for (const yearData of Object.values(activeTeams)) {
      for (const member of yearData.members) {
        if (member.departments.includes('prm')) {
          members.push({
            name: member.name,
            role: member.roles.join(' · '),
            photoBase: member.photoBase,
            objectPosition: member.objectPosition
          });
        }
      }
    }
    return members;
  }
};

export const SYSTEM_CAPABILITIES: Record<DeptKey, SystemCapability> = {
  mech: mechanicalCapability,
  elec: electronicsCapability,
  embed: embeddedCapability,
  auto: automationCapability,
  prm: prmCapability,
  mentor: {
    name: 'GUIDANCE',
    description: 'Faculty advisors and industry mentors who provide strategic direction and technical guidance to the team.',
    coreFunctions: ['Technical Guidance', 'Strategic Direction', 'Industry Connections', 'Project Oversight'],
    tools: ['Technical Consultation', 'Project Management', 'Industry Standards'],
    getMembers: () => {
      const members = [] as Array<{ name: string; role: string; photoBase?: string; objectPosition?: string }>;
      for (const yearData of Object.values(activeTeams)) {
        for (const member of yearData.members) {
          if (member.departments.includes('mentor')) {
            members.push({
              name: member.name,
              role: member.roles.join(' · '),
              photoBase: member.photoBase,
              objectPosition: member.objectPosition
            });
          }
        }
      }
      return members;
    }
  }
};

export default SYSTEM_CAPABILITIES;