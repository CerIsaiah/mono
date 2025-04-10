import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

const OnboardingStep1 = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Placeholder for Heart Logo */}
      <Image
        // source={require('../../assets/images/heart-logo.png')} // Add your heart logo here
        style={styles.logo}
      />
      <Text style={styles.title}>RIZZ APP</Text>
      <Text style={styles.subtitle}>AI Dating Assistant</Text>

      {/* Placeholder for Robot */}
      <Image
        // source={require('../../assets/images/robot.png')} // Add your robot image here
        style={styles.robot}
      />

      <Text style={styles.description}>
        Upload chats and get instant answers
        AI generates pick-up lines and responses
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/step2' as any)}>
        <Text style={styles.buttonText}>Continue</Text>
        {/* Add Arrow Icon if needed */}
      </TouchableOpacity>

      {/* Add pagination dots if using a carousel directly here */}
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
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    backgroundColor: '#ccc', // Placeholder background
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  robot: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    backgroundColor: '#eee', // Placeholder background
    marginBottom: 30,
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
  },
  buttonText: {
    color: '#6A0DAD',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OnboardingStep1; 