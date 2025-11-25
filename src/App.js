import { useState, useEffect } from "react";
import Web3 from "web3";
import GameBoard from "./components/GameBoard";
import LeaderboardPopup from "./components/LeaderboardPopup";
import Celo_2048_ABI from "./Celo2048_ABI.json";
import celoLogo from "./assets/celo-logo.jpg";
import { FiLogOut } from "react-icons/fi";
import { NETWORKS } from "./constants/networks";
import { sdk } from "@farcaster/miniapp-sdk";

export default function App() {
  // Responsive detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [gameMode, setGameMode] = useState("classic");
  const [account, setAccount] = useState(null);
  const [shortAddress, setShortAddress] = useState("");
  const [contract, setContract] = useState(null);
  const [network, setNetwork] = useState("mainnet");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState({ bestScores: [], totalScores: [] });
  const [scoreSaved, setScoreSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initFarcaster() {
      if (!sdk || !sdk.actions) {
        console.warn("Farcaster SDK not available (not running inside a Farcaster client?)");
        return;
      }

      try {
        await sdk.actions.ready({ disableNativeGestures: true });
        console.log("Farcaster ready called with disableNativeGestures");

        let context = null;
        try {
          context = await sdk.context.get();
          console.log("Farcaster context:", context);
        } catch (ctxErr) {
          console.warn("Could not get Farcaster context:", ctxErr);
        }

        const clientAddedFlag = context?.client?.added;
        const alreadyAsked = localStorage.getItem("farcasterPromptShown");

        if (mounted && clientAddedFlag === false && !alreadyAsked) {
          const confirmAdd = window.confirm(
            "Add Celo 2048 to your Farcaster Mini Apps for quick access?"
          );

          if (confirmAdd) {
            try {
              await sdk.actions.addMiniApp();
              console.log("User added the mini app (addMiniApp resolved)");
            } catch (addErr) {
              console.error("addMiniApp failed:", addErr);
              alert("Could not add mini app: " + (addErr?.message || addErr));
            }
          }

          localStorage.setItem("farcasterPromptShown", "true");
        }
      } catch (err) {
        console.error("Farcaster SDK init error:", err);

      }
    }

    initFarcaster();

    return () => {
      mounted = false;
    };
  }, []);

  const showNetworkToast = (msg) => {
    if (!isMobile) {
      setToastMessage(msg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const switchNetwork = async (net) => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORKS[net].chainId }],
      });
      showNetworkToast(`Network changed to ${NETWORKS[net].chainName}`);
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [NETWORKS[net]],
        });
        showNetworkToast(`Network added and switched to ${NETWORKS[net].chainName}`);
      } else console.error(e);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask");
    try {
      await switchNetwork(network);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const web3 = new Web3(window.ethereum);
      setAccount(accounts[0]);
      setShortAddress(accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4));
      setContract(new web3.eth.Contract(Celo_2048_ABI, NETWORKS[network].contractAddress));
      localStorage.setItem("connectedAccount", accounts[0]);
    } catch (e) {
      if (e.code !== 4001) console.error(e);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setShortAddress("");
    setContract(null);
    localStorage.removeItem("connectedAccount");
  };

  useEffect(() => {
    const storedAccount = localStorage.getItem("connectedAccount");
    if (storedAccount && window.ethereum) {
      const init = async () => {
        await switchNetwork(network);
        const web3 = new Web3(window.ethereum);
        setAccount(storedAccount);
        setShortAddress(storedAccount.slice(0, 6) + "..." + storedAccount.slice(-4));
        setContract(new web3.eth.Contract(Celo_2048_ABI, NETWORKS[network].contractAddress));
      };
      init();
    }
  }, []);

  const handleNewGame = () => setScoreSaved(false);

  const fetchLeaderboard = async () => {
    try {
      const web3 = new Web3(NETWORKS[network].rpcUrls[0]);
      const readOnlyContract = new web3.eth.Contract(Celo_2048_ABI, NETWORKS[network].contractAddress);

      const bestRaw = await readOnlyContract.methods.getBestScores().call();
      const totalRaw = await readOnlyContract.methods.getTotalScores().call();

      const bestScores = bestRaw[0].map((_, i) => ({
        player: bestRaw[0][i],
        score: parseInt(bestRaw[1][i]),
        time: parseInt(bestRaw[2][i]),
      })).sort((a, b) => b.score - a.score);

      const totalScores = totalRaw[0].map((_, i) => ({
        player: totalRaw[0][i],
        scoreTotal: parseInt(totalRaw[1][i]),
        gamesPlayed: parseInt(totalRaw[2][i]),
      })).sort((a, b) => b.scoreTotal - a.scoreTotal);

      setLeaderboardData({ bestScores, totalScores });
      setShowLeaderboard(true);
    } catch (e) {
      console.error(e);
      setLeaderboardData({ bestScores: [], totalScores: [] });
      setShowLeaderboard(true);
    }
  };

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
        position: "relative",
      }}
    >
      {/* Toast message */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 120,
            right: 20,
            zIndex: 11,
            backgroundColor: "#35d07f",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            fontWeight: "bold",
            transition: "all 0.5s ease",
            opacity: showToast ? 1 : 0,
            transform: showToast ? "translateY(0)" : "translateY(-20px)",
            pointerEvents: "none",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Network selector */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 20,
            zIndex: 10,
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(53,208,127,0.10)",
            padding: "12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minWidth: "180px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontWeight: "bold", fontSize: "14px", color: "#35d07f" }}>Network:</span>
            <select
              value={network}
              onChange={async (e) => {
                const newNet = e.target.value;
                setNetwork(newNet);
                await switchNetwork(newNet);
                if (account) {
                  const web3 = new Web3(window.ethereum);
                  setContract(new web3.eth.Contract(Celo_2048_ABI, NETWORKS[newNet].contractAddress));
                }
              }}
              onKeyDown={e => e.preventDefault()}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1.5px solid #35d07f",
                backgroundColor: "#f7fff7",
                color: "#222",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                outline: "none",
                width: "100%",
              }}
            >
              <option value="mainnet">Celo Mainnet</option>
              <option value="sepolia">Celo Sepolia</option>
            </select>
          </div>
          {network === "sepolia" && (
            <a
              href="https://faucet.celo.org/celo-sepolia"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "14px", color: "#35d07f", textDecoration: "underline" }}
            >
              Claim testnet CELO and start playing
            </a>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <img src={celoLogo} alt="Celo Logo" style={{ width: "50px", height: "50px" }} />
        <h1>Celo 2048</h1>
      </div>

      {!account ? (
        <button
          onClick={connectWallet}
          style={{ padding: "10px 20px", backgroundColor: "#35d07f", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", marginBottom: "20px" }}
        >
          Connect Wallet
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <p>Addr: {shortAddress}</p>
          <button
            onClick={disconnectWallet}
            title="Disconnect"
            style={{ background: "none", border: "none", padding: "6px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <FiLogOut size={22} color="#f5b700" />
          </button>
        </div>
      )}

      <button
        onClick={fetchLeaderboard}
        style={{ padding: "8px 16px", backgroundColor: "#f5b700", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", marginBottom: "20px" }}
      >
        Leaderboards
      </button>

      <GameBoard
        handleNewGame={handleNewGame}
        account={account}
        contract={contract}
        scoreSaved={scoreSaved}
        setScoreSaved={setScoreSaved}
        connectWallet={connectWallet}
        network={network}
        switchNetwork={switchNetwork}
        NETWORKS={NETWORKS}
        gameMode={gameMode}
      />

      {showLeaderboard && (
        <LeaderboardPopup leaderboardData={leaderboardData} onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
