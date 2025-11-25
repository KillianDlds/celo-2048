import React, { useState, useEffect, useRef, useCallback } from "react";
import Tile from "./Tile";
import { getSize, emptyGrid, addRandomTile, isGameOver, moveGrid } from "../utils/gameLogic";
import Web3 from "web3";
import { useAccount } from "wagmi";
import { openConnectModal } from "../librairies/appKit";
import Celo_2048_ABI from "../Celo2048_ABI.json";
import { NETWORKS } from "../constants/networks";
import { sdk } from "@farcaster/miniapp-sdk";

export default function GameBoard({ gameMode = "classic", network, switchNetwork, NETWORKS: parentNetworks }) {
  const size = getSize(gameMode);

  const [grid, setGrid] = useState(() => addRandomTile(addRandomTile(emptyGrid(size))));
  const [mergedGrid, setMergedGrid] = useState(() => emptyGrid(size));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [currentChainId, setCurrentChainId] = useState(null);


  const { isConnected, address } = useAccount();

  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  const NETWORK_CONTRACTS = {
    "42220": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET,
    "0xa4ec": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET,

    "1114572": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA,
    "0xaa044c": process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA,
  };


  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_chainId" }).then(setCurrentChainId);

      window.ethereum.on("chainChanged", (id) => {
        setCurrentChainId(id);
      });
    }
  }, []);

  const resolveContractAddress = useCallback(async () => {
    const nets = parentNetworks || NETWORKS || {};

    let chainId = null;
    try {
      if (window.ethereum) {
        chainId = await window.ethereum.request({ method: "eth_chainId" });
      }
    } catch (err) {
      console.warn("Could not read eth_chainId:", err);
    }

    if (!chainId && network && nets[network] && nets[network].chainId) {
      chainId = nets[network].chainId;
    }

    if (!chainId) {
      chainId = process.env.REACT_APP_CHAIN_ID || null;
    }

    if (!chainId) {
      console.warn("resolveContractAddress: no chainId determined");
      return null;
    }

    const tryKeys = [String(chainId).toLowerCase()];
    try {
      if (String(chainId).startsWith("0x")) {
        tryKeys.push(String(parseInt(chainId, 16)));
      } else if (!String(chainId).startsWith("0x")) {
        tryKeys.push("0x" + parseInt(chainId, 10).toString(16));
      }
    } catch (e) {
    }

    for (const k of tryKeys) {
      const found = Object.keys(nets).find((key) => String(key).toLowerCase() === String(k).toLowerCase());
      if (found && nets[found] && nets[found].contractAddress) {
        console.debug("resolveContractAddress found via nets mapping:", found, nets[found].contractAddress);
        return nets[found].contractAddress;
      }
    }

    const envMain = process.env.REACT_APP_CONTRACT_ADDRESS_CELO_MAINNET;
    const envSepolia = process.env.REACT_APP_CONTRACT_ADDRESS_CELO_SEPOLIA;
    const dec = tryKeys.find(k => !String(k).startsWith("0x"));
    if (dec) {
      if (dec === "42220" && envMain) return envMain;
      if ((dec === "1114572" || dec === "44787" || dec === "111") && envSepolia) return envSepolia;
    }

    return envSepolia || envMain || null;
  }, [network, parentNetworks]);

  const fetchMyBestScore = useCallback(async () => {
    if (!address) {
      console.debug("fetchMyBestScore: no address connected");
      return;
    }
    if (!window.ethereum) {
      console.debug("fetchMyBestScore: no provider (window.ethereum)");
      return;
    }

    try {
      const contractAddress = await resolveContractAddress();
      if (!contractAddress) {
        console.warn("fetchMyBestScore: no contract address resolved");
        return;
      }
      const web3 = new Web3(window.ethereum);
      const contract = new web3.eth.Contract(Celo_2048_ABI, contractAddress);

      const myScores = await contract.methods.scores(address).call();
      const onchainBest = Number(myScores.bestScore ?? myScores[0] ?? 0);
      console.debug("fetchMyBestScore ->", { address, contractAddress, onchainBest, raw: myScores });

      setBestScore(onchainBest);
    } catch (err) {
      console.error("fetchMyBestScore failed:", err);
    }
  }, [address, resolveContractAddress]);

  useEffect(() => {
    if (address) {
      fetchMyBestScore();
    } else {
      setBestScore(0);
    }
  }, [address, fetchMyBestScore]);


  const getSwipeDirection = (start, end) => {
    if (!start || !end) return null;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) return "right";
      if (dx < -30) return "left";
    } else {
      if (dy > 30) return "down";
      if (dy < -30) return "up";
    }
    return null;
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      touchEndRef.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dir = getSwipeDirection(touchStartRef.current, touchEndRef.current);
      if (dir) handleMove(dir);
    }
  };


  const handleMove = (dir) => {
    if (!timerActive) setTimerActive(true);
    const result = moveGrid(grid, dir);
    if (!result) return;

    setScore((prev) => {
      const newScore = prev + result.gainedScore;
      if (newScore > bestScore) {
        setBestScore(newScore);
      }
      return newScore;
    });

    if (JSON.stringify(result.grid) !== JSON.stringify(grid)) {
      setGrid(addRandomTile(result.grid));
      setMergedGrid(result.merged);
      if (isGameOver(result.grid)) setGameOver(true);
    } else {
      setMergedGrid(emptyGrid(size));
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (gameOver) return;
      if (e.key === "ArrowLeft") handleMove("left");
      if (e.key === "ArrowRight") handleMove("right");
      if (e.key === "ArrowUp") handleMove("up");
      if (e.key === "ArrowDown") handleMove("down");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [grid, gameOver, bestScore, timerActive]);

  useEffect(() => {
    if (!timerActive || gameOver) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (gameMode === "time" && prev >= 59) {
          clearInterval(interval);
          setGameOver(true);
          setTimerActive(false);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, gameOver, gameMode]);

  const restartGame = () => {
    setGrid(addRandomTile(addRandomTile(emptyGrid(size))));
    setMergedGrid(emptyGrid(size));
    setScore(0);
    setTimer(0);
    setTimerActive(false);
    setGameOver(false);
    setScoreSaved(false);
  };

  const handleSaveClick = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }

    if (scoreSaved) return;

    try {
      let chainId = null;
      let from = null;
      let txData = null;

      // ---------------------------
      // 1) Prépare la transaction (encode ABI)
      // ---------------------------
      const contractAddress =
        NETWORK_CONTRACTS[currentChainId] ||
        NETWORK_CONTRACTS["0x" + Number(currentChainId).toString(16)];

      if (!contractAddress) {
        alert("Aucun contrat pour ce réseau.");
        return;
      }

      // Web3 local juste pour encoder la méthode
      const web3Local = new Web3();
      const contractLocal = new web3Local.eth.Contract(Celo_2048_ABI, contractAddress);
      txData = contractLocal.methods.saveScore(score, timer).encodeABI();

      // ---------------------------
      // 2) FARCASTER MINI APP ?
      // ---------------------------
      const isFarcaster = typeof sdk !== "undefined" && sdk?.Ethereum;

      if (isFarcaster) {
        console.log("➡️ Sending TX via Farcaster SDK");

        // Adresse Farcaster
        const accounts = await sdk.Ethereum.getAccounts();
        from = accounts?.[0];
        if (!from) {
          alert("Aucune adresse Farcaster détectée.");
          return;
        }

        // ChainId Farcaster
        chainId = Number(await sdk.Ethereum.getChainId());

        // Envoi transaction via Farcaster
        await sdk.Ethereum.sendTransaction({
          from,
          to: contractAddress,
          data: txData,
          chainId
        });

        setScoreSaved(true);
        alert("Score saved successfully!");
        window.refreshLeaderboard?.();
        return;
      }

      // ---------------------------
      // 3) MODE WEB CLASSIQUE (Metamask / Rabby)
      // ---------------------------
      console.log("➡️ Sending TX via web3 provider");

      if (!window.ethereum) {
        alert("Aucun wallet détecté.");
        return;
      }

      const web3 = new Web3(window.ethereum);
      chainId = await window.ethereum.request({ method: "eth_chainId" });
      from = (await window.ethereum.request({ method: "eth_requestAccounts" }))?.[0];

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: contractAddress,
            data: txData
          }
        ]
      });

      setScoreSaved(true);
      alert("Score saved !");
      window.refreshLeaderboard?.();

    } catch (err) {
      console.error("SaveScore failed:", err);
      alert("Erreur: " + (err?.message || err));
    }
  };

  useEffect(() => {
    const onChainChanged = (chainId) => {
      console.debug("Provider chainChanged:", chainId);
      fetchMyBestScore();
    };
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on("chainChanged", onChainChanged);
    }
    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener("chainChanged", onChainChanged);
      }
    };
  }, [fetchMyBestScore]);


  useEffect(() => {
    if (!isConnected) {
      setBestScore(0);
    }
  }, [isConnected]);


  return (
    <>
      {gameOver && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "12px",
              textAlign: "center",
              width: "300px",
            }}
          >
            <h2>Game Over !</h2>
            <p>Score: {score}</p>
            <p>
              Time: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "15px" }}>
              <button
                onClick={restartGame}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#35d07f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Replay
              </button>
              <button
                onClick={handleSaveClick}
                disabled={scoreSaved}
                style={{
                  padding: "10px 20px",
                  backgroundColor: scoreSaved ? "#ccc" : "#f5b700",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: scoreSaved ? "not-allowed" : "pointer",
                }}
              >
                {scoreSaved ? "Score Saved" : isConnected ? "Save" : "Connect & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score / Best / Timer */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginBottom: "15px" }}>
        {["Score", "Best Score", "Time"].map((label, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#fff",
              padding: "6px 12px",
              borderRadius: "10px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
              minWidth: "60px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "bold", color: "#666" }}>{label}</span>
            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#222" }}>
              {label === "Score"
                ? score
                : label === "Best Score"
                  ? bestScore
                  : gameMode === "time"
                    ? `${Math.max(0, 60 - timer)}s`
                    : `${Math.floor(timer / 60)}:${(timer % 60).toString().padStart(2, "0")}`}
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="game-board-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, minmax(0, 80px))`,
          gap: window.innerWidth <= 600 ? "6px" : "10px",
          backgroundColor: "#fff8e1",
          padding: window.innerWidth <= 600 ? "8px" : "16px",
          borderRadius: "12px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          justifyContent: "center",
          touchAction: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {grid.map((row, i) =>
          row.map((val, j) => <Tile key={`${i}-${j}`} value={val} merged={mergedGrid[i][j]} />)
        )}
      </div>
    </>
  );
}
