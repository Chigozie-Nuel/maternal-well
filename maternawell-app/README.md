# Maternawell Nigeria - PPD Screening Application

## Project Overview

Maternawell Nigeria is a mobile-first web application designed to empower Primary Health Center (PHC) workers in Nigeria to screen mothers for postpartum depression (PPD) using the Edinburgh Postnatal Depression Scale (EPDS) and refer at-risk patients to appropriate support institutions.

## Features Implemented

### Core Functionality
- **Health Worker Authentication**: Secure login with facility selection
- **Mother Information Capture**: Comprehensive patient data collection
- **Digital EPDS Screening**: One question per screen with animated transitions
- **Automated Risk Scoring**: Uses Nigerian-validated cutoff ≥9
- **Item-10 Self-Harm Detection**: Triggers same-day escalation protocol
- **Referral Recommendation Engine**: Context-aware action suggestions
- **Results Dashboard**: Visual risk assessment with color-coded indicators
- **Offline-First Design**: Data persists in localStorage

### UI/UX Highlights
- **Senior Designer Quality**: Professional, modern interface
- **Montserrat Font**: Clean, readable typography from Google Fonts
- **Smooth Animations**: Framer Motion powered transitions
- **Responsive Design**: Works on all device sizes
- **Color-Coded Risk Levels**: 
  - 🟢 Low Risk (0-8): Green
  - 🟡 Moderate Risk (9-12): Orange  
  - 🔴 High Risk (13-30): Red
- **Icon System**: Lucide React icons throughout

## Tech Stack

- **Frontend Framework**: React 18.3
- **Build Tool**: Vite 5.4
- **Routing**: React Router DOM 6.26
- **Animations**: Framer Motion 11.3
- **Icons**: Lucide React
- **Styling**: CSS Variables + Custom Design System
- **State Management**: React Context API
- **Data Persistence**: LocalStorage (offline-first)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation

```bash
cd maternawell-app
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
```

Production files will be in the `dist/` directory.

## Usage Flow

1. **Login**: Health worker selects facility and enters credentials
2. **Dashboard**: View screening statistics and recent cases
3. **New Screening**: Enter mother's information
4. **EPDS Questions**: Answer 10 questions one at a time
5. **Results**: View score, risk level, and recommended actions
6. **Referral**: Access nearby facilities for referral if needed

## Default Test Credentials

For testing purposes, you can use any:
- **Facility**: Select from dropdown
- **Staff ID**: Any value (e.g., "HW001")
- **Password**: Any value (e.g., "password123")

*Note: This is a prototype. In production, implement proper authentication.*

## Compliance

Designed to comply with:
- Nigeria Data Protection Act 2023
- WHO Mental Health Gap Action Programme (mhGAP)
- Lagos State PHC Board guidelines

## Project Structure

```
maternawell-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context providers
│   │   ├── AuthContext.jsx
│   │   └── ScreeningContext.jsx
│   ├── pages/            # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MotherInfoForm.jsx
│   │   ├── ScreeningQuestion.jsx
│   │   └── Results.jsx
│   ├── utils/
│   │   └── constants.js  # EPDS questions, risk tiers, facilities
│   ├── App.jsx           # Main app with routing
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Key Design Decisions

1. **One Question Per Screen**: Reduces cognitive load, improves focus
2. **Progress Indicator**: Shows completion percentage
3. **Back/Next Navigation**: Allows answer revision
4. **Immediate Feedback**: Results shown instantly after completion
5. **Color Psychology**: Green for safety, red for urgency
6. **Animation Timing**: 0.3s transitions feel responsive but not rushed
7. **Card-Based Layout**: Familiar pattern, works well on mobile
8. **Gradient Accents**: Modern, professional appearance

## Future Enhancements

- Backend API integration
- Real-time sync when online
- SMS notifications for referrals
- Yoruba language support
- Supervisor dashboard
- Analytics and reporting
- Export to PDF functionality
- Biometric authentication

## License

This is a prototype for educational/demonstration purposes.
