pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "dentarvd/frontend"
    }

    stages {
        stage('Preparation') {
            steps {
                echo 'Preparation du pipeline Frontend DentaRDV'
                sh 'docker --version'
                sh 'docker run --rm aquasec/trivy:0.76.2 --version'
                sh 'git --version'
            }
        }

        stage('Tests et audit npm') {
            steps {
                sh '''
                    docker run --rm \
                      --volumes-from dentardv-jenkins \
                      -w "$WORKSPACE" \
                      node:22-alpine \
                      sh -c "npm ci && npm test && npm audit --audit-level=high"
                '''
            }
        }

        stage('Build Docker') {
            steps {
                sh '''
                    docker build \
                      -t ${DOCKER_IMAGE}:${BUILD_NUMBER} \
                      -t ${DOCKER_IMAGE}:latest .
                '''
            }
        }

        stage('Analyse Trivy') {
            steps {
                sh '''
                    echo "Rapport des vulnerabilites HIGH et CRITICAL"

                        docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v trivy-cache:/root/.cache \
                        aquasec/trivy:0.76.2 image \
                        --severity HIGH,CRITICAL \
                        ${DOCKER_IMAGE}:${BUILD_NUMBER} || true

                    echo "Verification bloquante des vulnerabilites CRITICAL"

                        docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v trivy-cache:/root/.cache \
                        aquasec/trivy:0.76.2 image \
                        --severity CRITICAL \
                        --exit-code 1 \
                        ${DOCKER_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Publication Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKERHUB_USER',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )]) {
                    sh '''
                        echo "$DOCKERHUB_TOKEN" | docker login \
                          -u "$DOCKERHUB_USER" --password-stdin

                        docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}
                        docker push ${DOCKER_IMAGE}:latest

                        docker logout
                    '''
                }
            }
        }
    }

   post {
        always {
            echo 'Fin du pipeline Frontend CI'
        }

        success {
            echo 'SUCCESS : frontend valide et publie sur Docker Hub'
        }

        failure {
            echo 'ECHEC : verifier les logs du pipeline Frontend'
        }
    }
}


