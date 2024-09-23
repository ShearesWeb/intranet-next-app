"use client";

import { useState } from "react";
export default function About() {
    const [message, setMessage] = useState('');
  
    const handlePing = async () => {
      try {
        const response = await fetch('/api/ping', {
          method: 'GET',
        });
        const data = await response.json();
        setMessage(data.message);
      } catch (error) {
        setMessage(`Error occurred while pinging, ${(error as Error).message}`);
      }
    };
  
    return (
      <div>
        <h1>This is the About Page.</h1>
        <button onClick={handlePing}>Ping API Working</button>
        {message && <p>{message}</p>}
        <button onClick={() => setMessage('')}>Reset</button>
      </div>
    );
  }