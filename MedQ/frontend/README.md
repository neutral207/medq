# README Med-Q Optimization Dashboard 

## Introduction 
**Med-Q Optimization Dashboard**
Is a real-time patient flow and queue management system designed to reduce medical wait times and inprove transparency for patients. This platform empowers medical offices administrators with predictive and analytics to anticipate patients surges and allocate resources efficienly helping patients feel more informed and reducing stress during their waiting experience.

---

## Features 

### Core Features 
- **Patient Check in Interface** - simple and intuitive system for patients to register their arrival. 
- **Queue Visualization Panel** – Real-time view of all patients in queue.  
- **Average Wait Time Display** – Displays estimated waiting time for each patient.  
- **Predictive Wait Time Engine** – Uses machine learning to forecast future wait times.  
- **Staff Load Monitor** – Tracks and visualizes current staff workload.  
- **Overload Alerts** – Notifies administrators when queues exceed thresholds.  
- **Basic Analytics Charts** – Visual dashboards showing key metrics.  
- **Role-Based Login** – Secure access for admins, staff, and patients.  
- **Database Logging & REST API** – All data interactions are logged with accessible endpoints.

### Growth Features 
- Historical Data Trends
- Staff Utilization Dashboard
- Configurable Simulation Settings
- Custom Data Export (CSV)
- Public Patient ETA Display

### Enhancement Features 
- Predictive Staffing Recommendations  
- Integration API for hospital systems  
- Heatmap of Wait Times by Hour/Day  
- AI-Powered Severity Classification  
- IoT Integration for Check-In Kiosks 

---

## Techonlogies

**Backend:**  
- Python (Flask) – Core backend framework  
- scikit-learn – Predictive modeling for patient flow  
- PyTest – Automated testing for backend logic  

**Frontend:**  
- React.js – Interactive dashboard and interfaces  
- D3.js & Chart.js – Dynamic data visualizations  
- Socket.io – Real-time updates and synchronization  

**Database & Infrastructure:**  
- PostgreSQL – Relational database  
- AWS – Cloud hosting and data storage  
- Docker – Containerized development and deployment  

---

## Installation 

### For End Users 
1. Visit the hosted web application (URL TBD).
2. Create or log in to your account (patient or staff).
3. Begin checking in, viewing your estimated wait time, and tracking your progress in the queue.

### For Local Use 
1. Clone this repository:
   ```bash
   git clone https://github.com/neutral207/medq
   cd medical-queue-dashboard
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   npm install
   ```
3. Run the backend server:
   ```bash
   python app.py
   ```
4. Run the React frontend:
   ```bash
   npm start
   ```
5. Visit ' ' to view the dashboard.

## License
This project is licensed under the **MIT License** – free for modification and distribution with attribution.

## Contributors 
- **Joel Simpson** – Project Lead, Backend Developer  
- **Amy Darr** -  UI and dashboard design  
- **Gustavo Bastos** - DevOps/Database Engineer – Database setup and Docker 
deployment 
- **Cheyenne McManhan** - Machine Learning Engineer – Prediction model creation and maintenance  

 - QA Engineer – API and UI testing

  **Project Status** 

  **Status:** Pre-Alpha
  The sataus of the project is settting everything up. 
  

