
import React from "react";

class ConfirmationModal extends React.Component {

  constructor(props) {
    super(props);

    console.log('Confirmation Modal constructor..');
  }

  render() {
    const title = this.props.title || '';
    const message = this.props.message || '';

    return (<div className="modal-dialog modal-sm">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">{title}</h5>
        </div>
        <div className="modal-body">
          {message}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={this.props.onConfirm}>Yes</button>
          <button type="button" className="btn btn-secondary" data-dismiss="modal" onClick={this.props.onCancel}>No</button>
        </div>
      </div>
    </div>);
  }
}

export default ConfirmationModal;
