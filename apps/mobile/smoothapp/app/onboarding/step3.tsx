import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

const OnboardingStep3 = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Placeholder for Phone Mockups */}
      <View style={styles.mockupContainer}>
        <Image
          // source={require('../../assets/images/phone-mockup-1.png')} // Add your first phone mockup image
          style={styles.mockupImage}
        />
        <Image
          // source={require('../../assets/images/phone-mockup-2.png')} // Add your second phone mockup image
          style={styles.mockupImage}
        />
      </View>

      {/* Placeholder for Robot */}
      <Image
        // source={require('../../assets/images/robot.png')} // Add your robot image here
        style={styles.robot}
      />

      <Text style={styles.title}>RIZZ Dating AI Assistant</Text>
      <Text style={styles.description}>
        Upload screenshots for perfect replies
        Boost your confidence with AI-crafted lines
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/step4' as any)}>
        <Text style={styles.buttonText}>Continue</Text>
        {/* Add Arrow Icon if needed */}
      </TouchableOpacity>

      {/* Add pagination dots */}
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={styles.dot} />
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
  mockupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    // Add perspective/rotation styles if needed to match the image
  },
  mockupImage: {
    width: 120, // Adjust as needed
    height: 240, // Adjust as needed
    resizeMode: 'contain',
    backgroundColor: '#eee', // Placeholder background
    marginHorizontal: -20, // Overlap effect
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#ccc',
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

export default OnboardingStep3; 