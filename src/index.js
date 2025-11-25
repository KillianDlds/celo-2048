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
  // CELO MAINNET
  "42220": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET, 
  "0xa4ec": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET, 

  // CELO SEPOLIA
 "1114572": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA,
  "0xaa044c": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA,
};


const RPC_FALLBACK = {
  [celo.chainId]: "https://forno.celo.org",
  [celoSepolia.chainId]: "https://alfajores-forno.celo-testnet.org",
};

function Root() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState({
    bestScores: [],
    totalScores: [],
  });


  async function fetchLeaderboard() {
    try {
      let chainIdHex = null;

      // 1) AppKit network si dispo
      try {
        const appKit = getAppKit();
        const activeNetwork = appKit?.getNetwork?.();
        if (activeNetwork?.chainId) chainIdHex = activeNetwork.chainId;
      } catch {}

      // 2) fallback : metamask
      if (!chainIdHex && window.ethereum) {
        chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      }

      if (!chainIdHex) {
        console.warn("❗ No chainId found for leaderboard.");
        return;
      }

      console.debug("📡 Fetching leaderboard on chain:", chainIdHex);

      // 3) Adresse du contrat
      const contractAddress =
        NETWORK_CONTRACTS[chainIdHex] ||
        NETWORK_CONTRACTS[Number(chainIdHex)];

      if (!contractAddress) {
        console.warn("❗ No contract for chain:", chainIdHex);
        return;
      }

      let web3;

      if (window.ethereum) {
        web3 = new Web3(window.ethereum);
      } else {
        const rpcUrl =
          RPC_FALLBACK[chainIdHex] ||
          RPC_FALLBACK[Number(chainIdHex)] ||
          RPC_FALLBACK[celoSepolia.chainId];

        web3 = new Web3(rpcUrl);
      }

      const contract = new web3.eth.Contract(Celo_2048_ABI, contractAddress);

      const bestRaw = await contract.methods.getBestScores().call();
      const totalRaw = await contract.methods.getTotalScores().call();

      console.debug("RAW bestScores:", bestRaw);
      console.debug("RAW totalScores:", totalRaw);

      const bestScores = (bestRaw[0] || [])
        .map((addr, i) => ({
          player: addr,
          score: Number(bestRaw[1][i] || 0),
          time: Number(bestRaw[2][i] || 0),
        }))
        .filter((x) => x.player);

      const totalScores = (totalRaw[0] || [])
        .map((addr, i) => ({
          player: addr,
          scoreTotal: Number(totalRaw[1][i] || 0),
          gamesPlayed: Number(totalRaw[2][i] || 0),
        }))
        .filter((x) => x.player);

      bestScores.sort((a, b) => b.score - a.score);
      totalScores.sort((a, b) => b.scoreTotal - a.scoreTotal);

      setLeaderboardData({ bestScores, totalScores });

      console.info(
        "🏆 Leaderboard updated.",
        bestScores.length,
        "best /",
        totalScores.length,
        "total"
      );
    } catch (err) {
      console.error("fetchLeaderboard ERROR:", err);
    }
  }

  window.refreshLeaderboard = fetchLeaderboard;

  useEffect(() => {
  if (!window.ethereum) return;

  const handleChainChanged = () => {
    console.log("Network changed, refreshing leaderboard...");
    fetchLeaderboard();
  };

  window.ethereum.on("chainChanged", handleChainChanged);

  return () => {
    window.ethereum.removeListener("chainChanged", handleChainChanged);
  };
}, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: "#fff8e1",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <img
          src={celoLogo}
          alt="Celo Logo"
          style={{ width: "50px", height: "50px" }}
        />
        <h1 style={{ fontSize: "1.8rem", fontWeight: "bold" }}>Celo 2048</h1>
      </div>

      <ConnectButton />

      {/* BUTTON LEADERBOARD */}
      <button
        onClick={async () => {
          await fetchLeaderboard();
          setShowLeaderboard(true);
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#f5b700",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          margin: "20px 0",
        }}
      >
        Leaderboards
      </button>

      <GameBoard />

      {/* POPUP */}
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
