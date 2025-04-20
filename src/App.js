import React, { useState, useEffect, useRef } from "react";
import {
  ChakraProvider,
  extendTheme,
  Box,
  Flex,
  Input,
  Button,
  Text,
  VStack,
  HStack,
  Avatar,
  IconButton,
  Heading,
  Spinner,
  useColorMode,
  Tooltip,
} from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";

const socket = io("https://maskchat.onrender.com", {
  secure: true,
  transports: ["websocket"],
  path: "/socket.io/",
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: "#000000",
        color: "whiteAlpha.900",
      },
      "@keyframes pulse": {
        "0%, 100%": {
          opacity: 0.5,
        },
        "50%": {
          opacity: 1,
        },
      },
    }),
  },
  colors: {
    customGreen: {
      500: "#4CAF50",
    },
    customRed: {
      500: "#F44336",
    },
  },
});

const ParticleAnimation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;

    if (!canvas) return; // Exit if canvas is not available

    const particles = Array.from(
      {
        length: 80,
      },
      () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        color: `hsla(${Math.random() * 60 + 260}, 70%, 60%, ${
          Math.random() * 0.3 + 0.1
        })`,
      })
    );

    const animate = () => {
      if (!canvasRef.current) return; // Exit if canvas is not available

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach((b) => {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.strokeStyle = `hsla(260, 70%, 60%, ${0.3 - dist / 333})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        });
      });

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };

    const resize = () => {
      if (canvasRef.current) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <Box
      as="canvas"
      ref={canvasRef}
      position="fixed"
      top={0}
      left={0}
      w="0%"
      h="0%"
      zIndex={-1}
    />
  );
};

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [room, setRoom] = useState(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [tabId] = useState(
    () => "tab-" + Math.random().toString(36).substr(2, 9)
  );
  const [interestsInput, setInterestsInput] = useState("");
  const [sharedInterests, setSharedInterests] = useState([]);
  const [useMatching, setUseMatching] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [matchTimeout, setMatchTimeout] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeout = useRef(null);
  const { colorMode, toggleColorMode } = useColorMode();
  const [partnerStatus, setPartnerStatus] = useState("offline");
  const [showMessage, setShowMessage] = useState(true);
  const [lastSeen, setLastSeen] = useState(null);
  const [socketInitialized, setSocketInitialized] = useState(false);

  useEffect(() => {
    //✅ All handlers declared INSIDE
    const handlePartnerFound = ({ room, sharedInterests }) => {
      console.log("Partner found! Room:", room, "Interests:", sharedInterests);
      setRoom(room);
      setSharedInterests(sharedInterests);
      setPartnerConnected(true);
      setIsSearching(false);
      setMatchTimeout(false);
      setPartnerStatus("online");
    };

    const handleMessage = (text) => {
      console.log("Received message:", text);
      setChat((prev) => [
        ...prev,
        {
          text,
          type: "received",
        },
      ]);
    };

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
      setSocketInitialized(true);
    });

    socket.on("partner-found", handlePartnerFound);
    socket.on("message", handleMessage);

    return () => {
      socket.off("partner-found", handlePartnerFound);
      socket.off("message", handleMessage);
      socket.off("connect");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() && room) {
      socket.emit("message", {
        room,
        text: message,
      });
      setChat((prev) => [
        ...prev,
        {
          text: message,
          type: "sent",
        },
      ]);
      setMessage("");
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (!typingTimeout.current) {
      socket.emit("typing", room);
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop-typing", room);
      typingTimeout.current = null;
    }, 1000);
  };

  const startChatting = () => {
    const interests = useMatching
      ? interestsInput
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean)
      : [];
    setShowWelcome(false);
    setIsSearching(true);
    setMatchTimeout(false);
    socket.emit("join", {
      tabId,
      interests,
      requireMatching: useMatching,
    });
  };

  const stopChatting = () => {
    if (room) {
      socket.emit("leave-room", room);
      socket.emit("stop-typing", room);
    }
    setRoom(null);
    setChat([]);
    setPartnerConnected(false);
    setShowWelcome(true);
    setIsSearching(false);
  };

  const findNewPartner = () => {
    setChat([]);
    setIsSearching(true);
    setMatchTimeout(false);
    const interests = useMatching
      ? interestsInput
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean)
      : [];
    socket.emit("join", {
      tabId,
      interests,
      requireMatching: useMatching,
    });
  };

  const getStatusText = () => {
    return (
      <Text
        color={partnerStatus === "online" ? "customGreen.500" : "customRed.500"}
      >
        {" "}
        {partnerStatus === "online" ? "Online" : "Offline"}{" "}
      </Text>
    );
  };

  return (
    <ChakraProvider theme={theme}>
      {" "}
      {showWelcome ? (
        <Box minH="100vh" position="relative">
          <ParticleAnimation />
          <Flex
            direction="column"
            align="center"
            justify="center"
            h="100vh"
            p={6}
            position="relative"
            zIndex={1}
          >
            <IconButton
              aria-label="Toggle color mode"
              icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
              position="absolute"
              top={4}
              right={4}
            />{" "}
            <Heading
              mb={8}
              fontSize="4xl"
              bgGradient="linear(to-r, #805ad5, #d53f8c)"
              bgClip="text"
            >
              OMECHAT{" "}
            </Heading>{" "}
            <Text
              mb={4}
              color="purple.200"
              fontWeight="bold"
              fontSize="md"
              textAlign="center"
            >
              🔒 Your chats are <u> encrypted </u>. You are completely
              anonymous.{" "}
            </Text>{" "}
            <Box
              bg="#0a0a0a"
              p={8}
              borderRadius="xl"
              boxShadow="dark-lg"
              w="100%"
              maxW="md"
            >
              <Flex align="center" mb={6}>
                <Avatar name="Anonymous" src="" mr={3} />{" "}
                <Text fontSize="xl"> Anonymous User </Text>{" "}
              </Flex>{" "}
              <VStack spacing={6}>
                <Flex align="center" w="100%">
                  <Text mr={3}> Interest Matching: </Text>{" "}
                  <Button
                    size="sm"
                    colorScheme={useMatching ? "purple" : "gray"}
                    onClick={() => setUseMatching(!useMatching)}
                  >
                    {" "}
                    {useMatching ? "ON" : "OFF"}{" "}
                  </Button>{" "}
                </Flex>{" "}
                {useMatching && (
                  <Box w="100%">
                    <Input
                      placeholder="music, coding, gaming"
                      value={interestsInput}
                      onChange={(e) => setInterestsInput(e.target.value)}
                      bg="#1a1a1a"
                      _placeholder={{
                        color: "whiteAlpha.600",
                      }}
                    />{" "}
                    <Text mt={2} fontSize="sm" color="whiteAlpha.600">
                      Separate interests with commas{" "}
                    </Text>{" "}
                  </Box>
                )}{" "}
                <Button
                  colorScheme="purple"
                  size="lg"
                  w="100%"
                  onClick={startChatting}
                  _hover={{
                    transform: "translateY(-2px)",
                    transition: "all 0.2s",
                  }}
                >
                  Start Chatting{" "}
                </Button>{" "}
              </VStack>{" "}
            </Box>{" "}
          </Flex>{" "}
        </Box>
      ) : isSearching ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          h="100vh"
          bg="#000000"
        >
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="#1a1a1a"
            color="purple.500"
            size="xl"
            mb={4}
          />{" "}
          <Text fontSize="xl" color="whiteAlpha.800">
            {" "}
            {matchTimeout
              ? "No partners found. Try again!"
              : "Finding your match..."}{" "}
          </Text>{" "}
          {matchTimeout && (
            <Button mt={4} colorScheme="purple" onClick={findNewPartner}>
              Try Again{" "}
            </Button>
          )}{" "}
        </Flex>
      ) : (
        <Box
          minH="100vh"
          bg="#000000"
          color="whiteAlpha.900"
          position="relative"
        >
          {" "}
          {showMessage && (
            <Text
              position="fixed"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              fontSize="3xl"
              fontWeight="bold"
              color="whiteAlpha.400"
              zIndex={0}
              textAlign="center"
              pointerEvents="none"
              w="full"
            >
              You are now chatting with an anonymous partner...{" "}
            </Text>
          )}{" "}
          <Flex direction="column" h="100vh" position="relative" zIndex={1}>
            {" "}
            {/* Chat header */}{" "}
            <Flex
              p={4}
              align="center"
              justify="space-between"
              bg="#0a0a0a"
              boxShadow="md"
            >
              <HStack>
                <Avatar name="Partner" src="" size="sm" />
                <Text fontSize="lg"> Anonymous Partner </Text>{" "}
                <Text
                  color={
                    partnerStatus === "online"
                      ? "customGreen.500"
                      : "customRed.500"
                  }
                >
                  {" "}
                  {partnerStatus === "online" ? "Online" : "Offline"}{" "}
                </Text>{" "}
              </HStack>{" "}
              <Button colorScheme="red" size="sm" onClick={stopChatting}>
                End Chat{" "}
              </Button>{" "}
            </Flex>
            {/* Shared interests */}{" "}
            {sharedInterests.length > 0 && (
              <Flex p={2} bg="#1a1a1a" justify="center">
                <Text fontSize="sm" color="purple.300">
                  Common interests: {sharedInterests.join(", ")}{" "}
                </Text>{" "}
              </Flex>
            )}
            {/* Typing indicator */}{" "}
            {partnerTyping && (
              <Box px={4} py={2} bg="#1a1a1a">
                <Flex align="center">
                  <Text mr={2} fontSize="sm" color="purple.300">
                    Partner is typing{" "}
                  </Text>{" "}
                  <Box animation="pulse 1.5s infinite"> ● </Box>{" "}
                  <Box animation="pulse 1.5s infinite" animationDelay="0.2s">
                    {" "}
                    ●{" "}
                  </Box>{" "}
                  <Box animation="pulse 1.5s infinite" animationDelay="0.4s">
                    {" "}
                    ●{" "}
                  </Box>{" "}
                </Flex>{" "}
              </Box>
            )}
            {/* Chat messages */}{" "}
            <Box flex={1} p={4} overflowY="auto">
              <VStack spacing={4} align="stretch">
                {" "}
                {chat.map((msg, i) => (
                  <Flex
                    key={i}
                    justify={msg.type === "sent" ? "flex-end" : "flex-start"}
                  >
                    <Box
                      bg={msg.type === "sent" ? "purple.600" : "#1a1a1a"}
                      color="whiteAlpha.900"
                      px={4}
                      py={2}
                      borderRadius="lg"
                      maxW="80%"
                      boxShadow="md"
                    >
                      <Text> {msg.text} </Text>{" "}
                    </Box>{" "}
                  </Flex>
                ))}{" "}
              </VStack>{" "}
            </Box>
            {/* Message input */}{" "}
            <Box p={4} bg="#0a0a0a">
              <HStack>
                <Box position="relative">
                  <IconButton
                    icon={<Text fontSize="xl"> 😊 </Text>}
                    aria-label="Emoji picker"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    variant="outline"
                    borderColor="whiteAlpha.400"
                    _hover={{
                      bg: "whiteAlpha.200",
                    }}
                    borderRadius="md"
                    size="sm"
                  />{" "}
                  {showEmojiPicker && (
                    <Box position="absolute" bottom="60px" left={0} zIndex={10}>
                      <EmojiPicker
                        onEmojiClick={(emojiData) => {
                          setMessage((prev) => prev + emojiData.emoji);
                          setShowEmojiPicker(false);
                        }}
                        width="100%"
                        height="350px"
                        theme="dark"
                      />
                    </Box>
                  )}{" "}
                </Box>{" "}
                <Input
                  placeholder="Type your message..."
                  value={message}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  bg="#1a1a1a"
                  _placeholder={{
                    color: "whiteAlpha.600",
                  }}
                  _focus={{
                    borderColor: "purple.500",
                  }}
                />{" "}
                <Button colorScheme="purple" px={6} onClick={sendMessage}>
                  Send{" "}
                </Button>{" "}
              </HStack>{" "}
            </Box>
            {/* Find new partner */}{" "}
            <Box
              p={4}
              bg="#0a0a0a"
              borderTopWidth="1px"
              borderTopColor="#1a1a1a"
            >
              <Button colorScheme="purple" w="100%" onClick={findNewPartner}>
                Find New Partner{" "}
              </Button>{" "}
            </Box>{" "}
          </Flex>{" "}
        </Box>
      )}{" "}
    </ChakraProvider>
  );
}

export default App;
