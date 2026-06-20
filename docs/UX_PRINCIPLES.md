# 🏰 Stillwater UX Principles

Core architectural and interface design principles for the Stillwater Sovereign Hive.

## 1. Interaction Patterns

### 1.1 Collapsible Elements
- **Default State**: When making a list or section collapsible, always **default to closed (collapsed)**. 
- **Rationale**: This preserves vertical real estate and allows the user to focus on the primary dashboard telemetry. Complex configuration or secondary metadata should only be engaged on-demand.
- **Visual Feedback**: Use a rotating chevron and a subtle "Click to expand" subtitle when collapsed.

## 2. Telemetry & Feedback

### 2.1 Synchronization
- **Cinematic Buffers**: Never snap states. Use a minimum of 4 seconds for "Synchronizing" states to ensure the user perceives the system's effort.
- **Success Lingering**: Once a task is complete, linger on a "STATE CONFIRMED" or "SUCCESS" state for at least 2 seconds before reverting to idle.
