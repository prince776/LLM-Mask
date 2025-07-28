package relay

type Message struct {
	Action         Action         `json:"action"`
	ForwardingInfo ForwardingInfo `json:"forwardingInfo,omitempty"`
	Data           []byte         `json:"data"`
}

type Action string

const (
	ActionForwardMsg Action = "forward-msg"
	ActionCallLLM    Action = "call-llm"
)

type ForwardingInfo struct {
	Host string `json:"host"` // <hostname> or <hostname>:<port>
}
