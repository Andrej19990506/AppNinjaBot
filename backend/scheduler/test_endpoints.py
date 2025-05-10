import requests
import json

BASE_URL = 'http://localhost:8002'

def test_endpoints():
    # Test health endpoint
    print("\nTesting /health:")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

    # Test availability status endpoint
    print("\nTesting /scheduler/availability/status:")
    try:
        response = requests.get(f"{BASE_URL}/scheduler/availability/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

    # Test availability endpoint
    print("\nTesting /scheduler/availability:")
    try:
        response = requests.post(f"{BASE_URL}/scheduler/availability")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_endpoints() 