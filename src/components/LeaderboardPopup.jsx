import { useState } from "react";

export default function LeaderboardPopup({ leaderboardData, onClose }) {
  const [activeTab, setActiveTab] = useState("best");

  const renderTable = () => {
    const isBest = activeTab === "best";
    const data = isBest ? leaderboardData.bestScores : leaderboardData.totalScores;

    if (!data || data.length === 0)
      return (
        <tr>
          <td colSpan={4} style={{ textAlign: "center" }}>
            No scores yet
          </td>
        </tr>
      );

    return data.map((entry, i) => (
      <tr key={i} style={{ textAlign: "center", borderBottom: "1px solid #ddd" }}>
        <td>{i + 1}</td>
        <td>{entry.player.slice(0, 6)}...{entry.player.slice(-4)}</td>
        <td>{isBest ? entry.score : entry.scoreTotal}</td>
        <td>
          {isBest
            ? `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`
            : entry.gamesPlayed}
        </td>
      </tr>
    ));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px",
          borderRadius: "12px",
          width: "600px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ textAlign: "center" }}>Leaderboard</h2>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", gap: "10px" }}>
          <button
            onClick={() => setActiveTab("best")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "best" ? "2px solid #35d07f" : "1px solid #ddd",
              backgroundColor: activeTab === "best" ? "#e0ffe4" : "#f8f8f8",
              cursor: "pointer",
            }}
          >
            Best Score
          </button>
          <button
            onClick={() => setActiveTab("total")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "total" ? "2px solid #35d07f" : "1px solid #ddd",
              backgroundColor: activeTab === "total" ? "#e0ffe4" : "#f8f8f8",
              cursor: "pointer",
            }}
          >
            Total Score
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: '10%' }}>#</th>
              <th style={{ width: '40%' }}>Address</th>
              <th style={{ width: '25%' }}>{activeTab === "best" ? "Score" : "Total Score"}</th>
              <th style={{ width: '25%' }}>{activeTab === "best" ? "Time" : "Games"}</th>
            </tr>
          </thead>
          <tbody>{renderTable()}</tbody>
        </table>

        <button
          onClick={onClose}
          style={{
            marginTop: "15px",
            padding: "8px 16px",
            backgroundColor: "#35d07f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
