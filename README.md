# Project Setup Guide

This project consists of a backend Node.js server and a frontend React application. Follow these steps to set up and run the project.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Git

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

4. Start the backend server:
   ```bash
   npm start
   ```
   The server will run on http://localhost:5000

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the frontend directory with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

4. Start the frontend development server:
   ```bash
   npm start
   ```
   The application will run on http://localhost:3000

## Development

- Backend API endpoints are available at http://localhost:5000/api
- Frontend development server runs on http://localhost:3000
- Any changes to the frontend code will automatically reload the development server
- Backend changes require a server restart

## Available Scripts

### Backend
- `npm start`: Starts the backend server
- `npm run dev`: Starts the backend server with nodemon for development
- `npm test`: Runs backend tests

### Frontend
- `npm start`: Starts the frontend development server
- `npm build`: Builds the frontend for production
- `npm test`: Runs frontend tests
- `npm run eject`: Ejects from Create React App

## Project Structure

```
project/
├── backend/
│   ├── node_modules/
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/
    ├── node_modules/
    ├── public/
    ├── src/
    ├── package.json
    └── .env
```

## Troubleshooting

1. If you encounter any port conflicts:
   - Backend: Change the PORT in backend/.env
   - Frontend: Change the port by setting PORT environment variable before starting

2. If dependencies fail to install:
   - Delete node_modules folder and package-lock.json
   - Run `npm install` again

3. If the frontend can't connect to the backend:
   - Ensure both servers are running
   - Check that the REACT_APP_API_URL in frontend/.env matches your backend URL
   - Verify CORS settings in the backend server.js

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

This project is licensed under the MIT License.
