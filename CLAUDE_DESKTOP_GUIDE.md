# VillageMetrics MCP for Claude Desktop

This Model Context Protocol (MCP) server provides access to VillageMetrics behavioral tracking data for families with children who have behavioral challenges.

## What is VillageMetrics?

VillageMetrics transforms daily voice journal entries into actionable behavioral insights through AI-powered analysis. Parents and caregivers record voice journal entries about their child's day, which are automatically analyzed overnight to:

- Calculate behavior scores on specific goals (1-4 scale)
- Extract behavioral data and identify patterns
- Correlate factors like activities, medications, and environmental conditions with behavioral outcomes
- Generate insights and recommendations

## Using This MCP

This MCP gives Claude access to query and analyze all of this behavioral data to help families understand patterns, track progress, and make data-driven decisions about care strategies.

### Key Concepts

- **Behavior Goals**: Specific, measurable aspects tracked (e.g., "Maintain Safety", "Follow Directions", "Stay Calm During Challenges")
- **Behavior Scores**: 1-4 scale where 4=Completely met, 3=Mostly met, 2=A little progress, 1=Not at all, NA=Not applicable
- **Journal Entries**: Voice-recorded daily observations automatically analyzed for behavioral insights
- **Hashtags**: Automatically extracted activities, triggers, and context from journal entries
- **Analysis**: Overnight processing that identifies what factors help or hinder each behavior goal

### Available Data

- Journal entries with full text content and analysis
- Daily behavior scores for each goal
- Medication tracking and correlation with behavior scores
- Hashtag analysis showing which activities/factors correlate with better outcomes
- Trend analysis and pattern recognition
- Date range metadata and data availability information

### Usage Tips

- Ask about specific time periods (e.g., "last week", "this month")
- Request behavior score analysis for particular goals
- Search journal entries by topics, activities, or behavioral patterns
- Explore medication effectiveness and behavioral correlations
- Identify patterns and triggers in behavioral data

### Important Notes

- All behavior scores use a 1-4 scale (not 1-10)
- Data is organized by individual children - make sure you're asking about the correct child
- Journal entries contain rich behavioral context beyond just scores
- The system focuses on family behavioral support, not medical diagnosis