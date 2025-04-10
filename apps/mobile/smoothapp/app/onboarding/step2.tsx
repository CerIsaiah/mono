import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

const OnboardingStep2 = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Placeholder for Chat Screenshot */}
      <Image
        // source={require('../../assets/images/chat-screenshot.png')} // Add your chat example screenshot
        style={styles.chatScreenshot}
      />

      {/* Placeholder for Robot */}
      <Image
        // source={require('../../assets/images/robot.png')} // Add your robot image here
        style={styles.robot}
      />

      <Text style={styles.title}>RIZZ Dating AI Helper</Text>
      <Text style={styles.description}>
        AI assists with replies for your chats
        Easily spark new connections with ease
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/step3' as any)}>
        <Text style={styles.buttonText}>Continue</Text>
        {/* Add Arrow Icon if needed */}
      </TouchableOpacity>

      {/* Add pagination dots */}
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={[styles.dot, styles.inactiveDot]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#6A0DAD', // Example Purple Color
    padding: 20,
  },
  chatScreenshot: {
    width: '90%',
    height: 200, // Adjust as needed
    resizeMode: 'contain',
    backgroundColor: '#eee', // Placeholder background
    marginBottom: 20,
    borderRadius: 10,
  },
  robot: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    backgroundColor: '#eee', // Placeholder background
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 80,
    borderRadius: 30,
    marginBottom: 20, // Space before pagination
  },
  buttonText: {
    color: '#6A0DAD',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  }
});

export default OnboardingStep2; 