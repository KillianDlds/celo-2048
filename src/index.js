import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { AppKitProvider, getAppKit } from "./librairies/appKit";
import ConnectButton from "./components/ConnectButton";
import GameBoard from "./components/GameBoard";
import LeaderboardPopup from "./components/LeaderboardPopup";
import celoLogo from "./assets/celo-logo.jpg";
import "./index.css";
import Web3 from "web3";
import Celo_2048_ABI from "./Celo2048_ABI.json";
import { celo, celoSepolia } from "@reown/appkit/networks";

const NETWORK_CONTRACTS = {
  [celo.chainId]: process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET,
  [celoSepolia.chainId]: process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA,
};

function Root() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState({
    bestScores: [],
    totalScores: [],
  });

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!window.ethereum) return;

      try {
        const appKit = getAppKit();
        if (!appKit) return;

        // Récupère le réseau connecté via AppKit
        const activeNetwork = appKit.adapters[0]?.wagmiAdapter?.network;
        if (!activeNetwork) return;

        const contractAddress = NETWORK_CONTRACTS[activeNetwork.chainId];
        if (!contractAddress) {
          console.warn("Réseau non supporté pour le leaderboard");
          return;
        }

        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(Celo_2048_ABI, contractAddress);

        // Best scores
        const [bestAddrs, bestScoresArr, bestTimes] = await contract.methods.getBestScores().call();
        const bestScores = bestAddrs.map((addr, i) => ({
          player: addr,
          score: parseInt(bestScoresArr[i]),
          time: parseInt(bestTimes[i]),
        })).sort((a, b) => b.score - a.score);

        // Total scores
        const [totalAddrs, totalScoresArr, totalGames] = await contract.methods.getTotalScores().call();
        const totalScores = totalAddrs.map((addr, i) => ({
          player: addr,
          scoreTotal: parseInt(totalScoresArr[i]),
          gamesPlayed: parseInt(totalGames[i]),
        })).sort((a, b) => b.scoreTotal - a.scoreTotal);

        setLeaderboardData({ bestScores, totalScores });
      } catch (err) {
        console.error("Erreur récupération leaderboard:", err);
      }
    }

    fetchLeaderboard();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", padding: "20px", backgroundColor: "#fff8e1", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <img src={celoLogo} alt="Celo Logo" style={{ width: "50px", height: "50px" }} />
        <h1 style={{ fontSize: "1.8rem", fontWeight: "bold" }}>Celo 2048</h1>
      </div>

      <ConnectButton />

      <button
        onClick={() => setShowLeaderboard(true)}
        style={{ padding: "8px 16px", backgroundColor: "#f5b700", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", margin: "20px 0" }}
      >
        Leaderboards
      </button>

      <GameBoard />

      {showLeaderboard && (
        <LeaderboardPopup
          leaderboardData={leaderboardData}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppKitProvider>
      <Root />
    </AppKitProvider>
  </React.StrictMode>
);
